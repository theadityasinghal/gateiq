"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { caseMember, profile, shipmentCase, user } from "@/db/schema";
import { ONE_PER_CASE, ROLE_INFO, canInvite, invitableRoles, type Role } from "@/lib/roles";
import { validateUsername } from "@/lib/username";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireOnboardedUser, type OnboardedUser } from "@/server/session";
import { audit } from "@/server/audit";
import { getCaseForUser, type CaseForUser } from "./service";
import { removeWithInvitees } from "./membership";
import { declareConsigneeFact } from "./facts-data";

export type Invitee = { name: string; username: string; role: Role; roleLabel: string };
export type InviteResult = { ok: true; invitee: Invitee; sent?: boolean } | { ok: false; error: string };

const NO_SUCH_USER = "No account has that username. Check the spelling; it has to match exactly.";

function listLabels(roles: readonly Role[]) {
  return roles.map((r) => ROLE_INFO[r].label).join(" or ");
}

/** Every reason an invite can't go ahead, checked the same way for the lookup and for the send. */
async function checkInvitee(c: CaseForUser, me: OnboardedUser, rawUsername: string) {
  const allowed = invitableRoles(me.role);
  if (!allowed.length) return { error: `A ${ROLE_INFO[me.role].label} can't invite anyone to a case.` } as const;
  const handle = validateUsername(rawUsername);
  if (!handle.ok) return { error: NO_SUCH_USER } as const;

  const [target] = await db
    .select({ id: user.id, name: user.name, username: user.username, role: user.role, profileUserId: profile.userId })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.username, handle.username));
  if (!target || !target.username) return { error: NO_SUCH_USER } as const;
  if (target.id === me.id) return { error: "That's your own username." } as const;
  if (target.id === c.ownerId) return { error: `@${target.username} owns this case.` } as const;
  if (!target.role || !target.profileUserId) return { error: `@${target.username} hasn't finished setting up their account yet.` } as const;
  if (!canInvite(me.role, target.role)) {
    return {
      error: `@${target.username} is a ${ROLE_INFO[target.role].label}. As a ${ROLE_INFO[me.role].label} you can invite a ${listLabels(allowed)}.`,
    } as const;
  }
  const [existing] = await db
    .select({ status: caseMember.status })
    .from(caseMember)
    .where(and(eq(caseMember.caseId, c.id), eq(caseMember.userId, target.id)));
  if (existing) {
    return {
      error: existing.status === "pending" ? `@${target.username} is already invited and hasn't replied yet.` : `@${target.username} is already on this case.`,
    } as const;
  }
  if (ONE_PER_CASE.includes(target.role)) {
    const [other] = await db
      .select({ username: user.username })
      .from(caseMember)
      .innerJoin(user, eq(user.id, caseMember.userId))
      .where(and(eq(caseMember.caseId, c.id), eq(caseMember.role, target.role)));
    if (other) {
      return {
        error: `This case already has a ${ROLE_INFO[target.role].label} (@${other.username}). Remove them first to invite someone else.`,
      } as const;
    }
  }
  return {
    target: { id: target.id, role: target.role },
    invitee: { name: target.name, username: target.username, role: target.role, roleLabel: ROLE_INFO[target.role].label },
  } as const;
}

/** Exact-username lookup, so the inviter sees who they are about to invite before sending. */
export async function findInvitee(caseCode: string, username: string): Promise<InviteResult> {
  const me = await requireOnboardedUser();
  const c = await getCaseForUser(caseCode, me.id);
  if (!c) return { ok: false, error: "You don't have access to this case." };
  const r = await checkInvitee(c, me, username);
  return "error" in r ? { ok: false, error: r.error! } : { ok: true, invitee: r.invitee };
}

export async function inviteToCase(caseCode: string, username: string): Promise<InviteResult> {
  const me = await requireOnboardedUser();
  const c = await getCaseForUser(caseCode, me.id);
  if (!c) return { ok: false, error: "You don't have access to this case." };
  const r = await checkInvitee(c, me, username);
  if ("error" in r) return { ok: false, error: r.error! };
  let taken: string | null = null;
  try {
    await db.transaction(async (tx) => {
      // Invites to one case go one at a time, so a second consignee can't slip in between check and insert.
      await tx.select({ id: shipmentCase.id }).from(shipmentCase).where(eq(shipmentCase.id, c.id)).for("update");
      if (ONE_PER_CASE.includes(r.target.role)) {
        const [other] = await tx
          .select({ username: user.username })
          .from(caseMember)
          .innerJoin(user, eq(user.id, caseMember.userId))
          .where(and(eq(caseMember.caseId, c.id), eq(caseMember.role, r.target.role)));
        if (other) {
          taken = `This case already has a ${ROLE_INFO[r.target.role].label} (@${other.username}). Remove them first to invite someone else.`;
          return;
        }
      }
      const [row] = await tx
        .insert(caseMember)
        .values({ caseId: c.id, userId: r.target.id, invitedBy: me.id, role: r.target.role })
        .returning({ id: caseMember.id });
      await audit(
        {
          actorId: me.id,
          action: "case.member_invited",
          entityType: "case",
          entityId: c.id,
          details: { caseCode: c.caseCode, memberId: row.id, invitee: r.invitee.username, inviteeRole: r.target.role },
        },
        tx,
      );
    });
  } catch {
    // The unique (case, user) index: someone else invited them a moment ago.
    return { ok: false, error: `@${r.invitee.username} is already invited.` };
  }
  if (taken) return { ok: false, error: taken };
  revalidatePath(`/cases/${c.caseCode}`, "layout");
  return { ok: true, invitee: r.invitee, sent: true };
}

/** The invitee accepts or declines. Declining deletes the invite, so they can be invited again later. */
export async function respondToInvite(memberId: string, accept: boolean): Promise<ActionResult> {
  const me = await requireOnboardedUser();
  memberId = String(memberId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) return fail("That invite no longer exists.");
  const [row] = await db
    .select({ id: caseMember.id, caseId: caseMember.caseId, status: caseMember.status, role: caseMember.role, invitedBy: caseMember.invitedBy, caseCode: shipmentCase.caseCode })
    .from(caseMember)
    .innerJoin(shipmentCase, eq(shipmentCase.id, caseMember.caseId))
    .where(and(eq(caseMember.id, memberId), eq(caseMember.userId, me.id)));
  if (!row || row.status !== "pending") {
    revalidatePath("/", "layout");
    return fail("That invite is no longer waiting for you.");
  }
  await db.transaction(async (tx) => {
    if (accept) {
      await tx.update(caseMember).set({ status: "accepted", respondedAt: new Date() }).where(eq(caseMember.id, row.id));
      if (row.role === "consignee") {
        // The consignee's name, as it should appear on the shipping bill, becomes a verified fact: put forward by
        // them, agreed to by the consignor who invited them.
        const [[inviter], [prof]] = await Promise.all([
          tx.select({ role: user.role }).from(user).where(eq(user.id, row.invitedBy)),
          tx.select({ organisation: profile.organisation, legalName: profile.legalName }).from(profile).where(eq(profile.userId, me.id)),
        ]);
        if (inviter?.role) {
          await declareConsigneeFact(tx, {
            caseId: row.caseId,
            caseCode: row.caseCode,
            consignee: { id: me.id, role: me.role, partyName: prof?.organisation || prof?.legalName || me.name },
            inviter: { id: row.invitedBy, role: inviter.role },
          });
        }
      }
    } else {
      await tx.delete(caseMember).where(eq(caseMember.id, row.id));
    }
    await audit(
      {
        actorId: me.id,
        action: accept ? "case.invite_accepted" : "case.invite_declined",
        entityType: "case",
        entityId: row.caseId,
        details: { caseCode: row.caseCode, memberId: row.id },
      },
      tx,
    );
  });
  revalidatePath("/", "layout");
  revalidatePath(`/cases/${row.caseCode}`, "layout");
  return ok;
}

/**
 * Cancels a pending invite or removes an accepted member. Allowed for the case owner and for whoever
 * sent the invite. Everyone the removed person invited is removed too.
 */
export async function removeMember(memberId: string): Promise<ActionResult> {
  const me = await requireOnboardedUser();
  memberId = String(memberId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(memberId)) return ok;
  const [row] = await db
    .select({
      id: caseMember.id,
      caseId: caseMember.caseId,
      userId: caseMember.userId,
      invitedBy: caseMember.invitedBy,
      status: caseMember.status,
      ownerId: shipmentCase.ownerId,
      caseCode: shipmentCase.caseCode,
    })
    .from(caseMember)
    .innerJoin(shipmentCase, eq(shipmentCase.id, caseMember.caseId))
    .where(eq(caseMember.id, memberId));
  if (!row) return ok; // already gone
  if (me.id !== row.ownerId && me.id !== row.invitedBy) return fail("Only the case owner or whoever invited them can remove this person.");
  // An inviter who has since lost access can't act on the case any more.
  if (me.id !== row.ownerId && !(await getCaseForUser(row.caseCode, me.id))) return fail("You don't have access to this case.");

  await db.transaction(async (tx) => {
    const removed = await removeWithInvitees(tx, row.caseId, [row.userId]);
    const names = removed.length
      ? await tx.select({ id: user.id, username: user.username }).from(user).where(inArray(user.id, removed.map((r) => r.userId)))
      : [];
    const byId = new Map(names.map((n) => [n.id, n.username]));
    await audit(
      {
        actorId: me.id,
        action: row.status === "pending" ? "case.invite_cancelled" : "case.member_removed",
        entityType: "case",
        entityId: row.caseId,
        details: {
          caseCode: row.caseCode,
          memberId: row.id,
          removed: removed.map((r) => ({ username: byId.get(r.userId) ?? r.userId, status: r.status })),
        },
      },
      tx,
    );
  });
  revalidatePath(`/cases/${row.caseCode}`, "layout");
  revalidatePath("/", "layout");
  return ok;
}
