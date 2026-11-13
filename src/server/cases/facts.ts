"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { caseFact, caseFactConfirmation, shipmentCase } from "@/db/schema";
import { FACTS } from "@/lib/checks/facts";
import { FACT_AUTHORITY, canConfirm, canDeclare, isVerifiable, type FactView } from "@/lib/facts/ladder";
import { ROLE_INFO, isReadOnly, type Role } from "@/lib/roles";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { inlineLabel } from "@/lib/format";
import { requireOnboardedUser } from "@/server/session";
import { audit } from "@/server/audit";
import { getCaseForUser } from "./service";
import { loadCasePage } from "./page-data";

const listRoles = (roles: readonly Role[]) => roles.map((r) => ROLE_INFO[r].label).join(" or ");

/**
 * One tap on "Confirm this value". The value comes from the case itself (a document or the case record), never
 * from the browser: the action finds the group with this display in the checks and takes its value and the
 * documents behind it as evidence.
 *   - It matches the verified value: adds the viewer's confirmation (a different account in a different role).
 *   - There is no verified value, or it differs: puts this one forward, if the viewer's account type may set it.
 */
export async function confirmFact(caseCode: string, input: { factKey: string; scope: string; display: string }): Promise<ActionResult> {
  const me = await requireOnboardedUser();
  const c = await getCaseForUser(caseCode, me.id);
  if (!c) return fail("You don't have access to this case.");
  if (isReadOnly(me.role)) return fail("Your account type can only view this case.");
  if (!isVerifiable(input.factKey)) return fail("That can't be verified.");
  const key = input.factKey;

  const data = await loadCasePage(c.caseCode, me.id, me.role);
  if (!data) return fail("You don't have access to this case.");
  const result = [...data.report.containers.flatMap((x) => x.results), ...data.report.caseChecks].find((r) => r.fact === key && r.scope === input.scope);
  const group = result?.groups.find((g) => g.display === input.display);
  if (!result || !group || group.value === undefined) return fail("That value is no longer on the case. Refresh and try again.");
  const evidence = [...new Set(group.sources.map((s) => s.submissionId).filter((x): x is string => !!x))];

  let failure: string | null = null;
  await db.transaction(async (tx) => {
    // One change at a time per case, so two taps can't both become the current value.
    await tx.select({ id: shipmentCase.id }).from(shipmentCase).where(eq(shipmentCase.id, c.id)).for("update");
    const [current] = await tx
      .select()
      .from(caseFact)
      .where(and(eq(caseFact.caseId, c.id), eq(caseFact.factKey, key), eq(caseFact.scope, input.scope), isNull(caseFact.supersededAt)));
    const details = { caseCode: c.caseCode, factKey: key, scope: input.scope, display: input.display };

    if (current && FACTS[key].compare(current.value, group.value!) === 0) {
      const confirmations = await tx.select({ userId: caseFactConfirmation.userId, role: caseFactConfirmation.role }).from(caseFactConfirmation).where(eq(caseFactConfirmation.factId, current.id));
      const can = canConfirm(
        { id: me.id, role: me.role },
        {
          level: "declared",
          setBy: { userId: current.setBy, role: current.setByRole as Role },
          confirmations: confirmations.map((x) => ({ userId: x.userId, role: x.role as Role, name: "", at: new Date() })),
        } as Pick<FactView, "level" | "setBy" | "confirmations">,
      );
      if (!can.ok) {
        failure = can.reason;
        return;
      }
      await tx.insert(caseFactConfirmation).values({ factId: current.id, userId: me.id, role: me.role }).onConflictDoNothing();
      await audit({ actorId: me.id, action: "fact.confirmed", entityType: "case", entityId: c.id, details }, tx);
      return;
    }

    if (!canDeclare(me.role, key)) {
      failure = `Only a ${listRoles(FACT_AUTHORITY[key])} can set the ${inlineLabel(FACTS[key].label)}. Ask them to put this value forward${current ? " or correct their document" : ""}.`;
      return;
    }
    if (current) await tx.update(caseFact).set({ supersededAt: new Date() }).where(eq(caseFact.id, current.id));
    const [row] = await tx
      .insert(caseFact)
      .values({ caseId: c.id, factKey: key, scope: input.scope, value: group.value!, display: input.display, setBy: me.id, setByRole: me.role, evidence })
      .returning({ id: caseFact.id });
    if (current) await tx.update(caseFact).set({ supersededBy: row.id }).where(eq(caseFact.id, current.id));
    await audit({ actorId: me.id, action: current ? "fact.replaced" : "fact.declared", entityType: "case", entityId: c.id, details: { ...details, from: current?.display ?? null } }, tx);
  });
  if (failure) return fail(failure);
  revalidatePath(`/cases/${c.caseCode}`, "layout");
  revalidatePath("/dashboard");
  return ok;
}

/** Withdraws a verified value, so its documents go back to being compared with each other. For those who may set it, and the case owner. */
export async function retireFact(caseCode: string, factId: string): Promise<ActionResult> {
  const me = await requireOnboardedUser();
  const c = await getCaseForUser(caseCode, me.id);
  if (!c) return fail("You don't have access to this case.");
  if (isReadOnly(me.role)) return fail("Your account type can only view this case.");
  if (!/^[0-9a-f-]{36}$/i.test(factId)) return fail("Not found.");
  let failure: string | null = null;
  await db.transaction(async (tx) => {
    const [f] = await tx.select().from(caseFact).where(and(eq(caseFact.id, factId), eq(caseFact.caseId, c.id), isNull(caseFact.supersededAt)));
    if (!f || !isVerifiable(f.factKey)) {
      failure = "That value was already withdrawn or changed.";
      return;
    }
    if (c.access !== "owner" && !canDeclare(me.role, f.factKey)) {
      failure = `Only a ${listRoles(FACT_AUTHORITY[f.factKey])} or the case owner can withdraw this value.`;
      return;
    }
    await tx.update(caseFact).set({ supersededAt: new Date() }).where(eq(caseFact.id, f.id));
    await audit({ actorId: me.id, action: "fact.retired", entityType: "case", entityId: c.id, details: { caseCode: c.caseCode, factKey: f.factKey, scope: f.scope, display: f.display } }, tx);
  });
  if (failure) return fail(failure);
  revalidatePath(`/cases/${c.caseCode}`, "layout");
  revalidatePath("/dashboard");
  return ok;
}
