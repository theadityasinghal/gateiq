import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { caseFact, caseFactConfirmation, user } from "@/db/schema";
import { caseRecordClaims, type CheckCase } from "@/lib/checks/claims";
import { alias } from "drizzle-orm/pg-core";
import { effectiveLevel, isVerifiable, type FactConfirmation, type FactView } from "@/lib/facts/ladder";
import type { Role } from "@/lib/roles";
import { audit } from "@/server/audit";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const setter = alias(user, "fact_setter");
const confirmer = alias(user, "fact_confirmer");

/** The current verified values for these cases (superseded ones are left out), with who set and confirmed them. One query. */
export async function loadFacts(caseIds: string[]): Promise<Map<string, FactView[]>> {
  const out = new Map<string, FactView[]>();
  if (!caseIds.length) return out;
  const rows = await db
    .select({
      f: caseFact,
      setterName: setter.name,
      confUserId: caseFactConfirmation.userId,
      confRole: caseFactConfirmation.role,
      confAt: caseFactConfirmation.createdAt,
      confName: confirmer.name,
    })
    .from(caseFact)
    .innerJoin(setter, eq(setter.id, caseFact.setBy))
    .leftJoin(caseFactConfirmation, eq(caseFactConfirmation.factId, caseFact.id))
    .leftJoin(confirmer, eq(confirmer.id, caseFactConfirmation.userId))
    .where(and(inArray(caseFact.caseId, caseIds), isNull(caseFact.supersededAt)));

  const byFact = new Map<string, { f: typeof caseFact.$inferSelect; setterName: string; confirmations: FactConfirmation[] }>();
  for (const r of rows) {
    const entry = byFact.get(r.f.id) ?? { f: r.f, setterName: r.setterName, confirmations: [] };
    if (r.confUserId && r.confRole && r.confAt) entry.confirmations.push({ userId: r.confUserId, role: r.confRole as Role, name: r.confName ?? "", at: r.confAt });
    byFact.set(r.f.id, entry);
  }
  for (const { f, setterName, confirmations } of byFact.values()) {
    if (!isVerifiable(f.factKey)) continue;
    const setBy = { userId: f.setBy, name: setterName, role: f.setByRole as Role };
    const view: FactView = {
      id: f.id,
      factKey: f.factKey,
      scope: f.scope,
      value: f.value,
      display: f.display,
      level: effectiveLevel({ level: f.level, setBy, confirmations }),
      setBy,
      setAt: f.createdAt,
      evidence: f.evidence,
      confirmations,
    };
    out.set(f.caseId, [...(out.get(f.caseId) ?? []), view]);
  }
  return out;
}

export async function listCaseFacts(caseId: string): Promise<FactView[]> {
  return (await loadFacts([caseId])).get(caseId) ?? [];
}

/** When a case is created, what the consignor declared (port, HS codes, packages, weight) becomes their declared facts. */
export async function declareCaseRecordFacts(tx: Tx, input: { caseId: string; caseCode: string; owner: { id: string; role: Role }; record: CheckCase }) {
  const claims = caseRecordClaims(input.record, { submissionId: null, docType: "case", label: "Case", role: input.owner.role, adderName: "" });
  const rows = claims.filter((c) => isVerifiable(c.fact));
  if (!rows.length) return;
  await tx.insert(caseFact).values(
    rows.map((c) => ({ caseId: input.caseId, factKey: c.fact, scope: "case", value: c.value, display: c.display, setBy: input.owner.id, setByRole: input.owner.role, evidence: [] })),
  );
  await audit({ actorId: input.owner.id, action: "fact.declared", entityType: "case", entityId: input.caseId, details: { caseCode: input.caseCode, seeded: rows.map((c) => c.fact) } }, tx);
}

/**
 * When the consignee accepts, their name (as it should appear on the shipping bill) becomes a fact: put forward
 * by the consignee, agreed to by the consignor who invited them, so it starts confirmed.
 */
export async function declareConsigneeFact(
  tx: Tx,
  input: { caseId: string; caseCode: string; consignee: { id: string; role: Role; partyName: string }; inviter: { id: string; role: Role } },
) {
  const [existing] = await tx
    .select({ id: caseFact.id })
    .from(caseFact)
    .where(and(eq(caseFact.caseId, input.caseId), eq(caseFact.factKey, "consignee.name"), eq(caseFact.scope, "case"), isNull(caseFact.supersededAt)));
  if (existing) await tx.update(caseFact).set({ supersededAt: new Date() }).where(eq(caseFact.id, existing.id));
  const [row] = await tx
    .insert(caseFact)
    .values({ caseId: input.caseId, factKey: "consignee.name", scope: "case", value: input.consignee.partyName, display: input.consignee.partyName, setBy: input.consignee.id, setByRole: input.consignee.role })
    .returning({ id: caseFact.id });
  if (existing) await tx.update(caseFact).set({ supersededBy: row.id }).where(eq(caseFact.id, existing.id));
  if (input.inviter.role !== input.consignee.role) {
    await tx.insert(caseFactConfirmation).values({ factId: row.id, userId: input.inviter.id, role: input.inviter.role });
  }
  await audit({ actorId: input.consignee.id, action: "fact.declared", entityType: "case", entityId: input.caseId, details: { caseCode: input.caseCode, factKey: "consignee.name", display: input.consignee.partyName, confirmedBy: input.inviter.id } }, tx);
}
