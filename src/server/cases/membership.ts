import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { caseMember } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Removes these people from a case, together with everyone they invited, and everyone those people
 * invited, and so on: their access came through the person being removed.
 * Returns the removed rows.
 */
export async function removeWithInvitees(tx: Tx, caseId: string, userIds: string[]) {
  const rows = await tx
    .select({ id: caseMember.id, userId: caseMember.userId, invitedBy: caseMember.invitedBy, status: caseMember.status })
    .from(caseMember)
    .where(eq(caseMember.caseId, caseId));

  const removed = new Set<string>();
  let frontier = userIds.filter((id) => rows.some((r) => r.userId === id));
  frontier.forEach((id) => removed.add(id));
  while (frontier.length) {
    const next = rows.filter((r) => frontier.includes(r.invitedBy) && !removed.has(r.userId)).map((r) => r.userId);
    next.forEach((id) => removed.add(id));
    frontier = next;
  }
  if (!removed.size) return [];
  const ids = [...removed];
  await tx.delete(caseMember).where(and(eq(caseMember.caseId, caseId), inArray(caseMember.userId, ids)));
  return rows.filter((r) => removed.has(r.userId));
}

/** For a role change: drops the user from every case they were invited to, with everyone they invited. */
export async function removeUserFromAllCases(tx: Tx, userId: string) {
  const memberships = await tx.select({ caseId: caseMember.caseId }).from(caseMember).where(eq(caseMember.userId, userId));
  const removed: { caseId: string; userIds: string[] }[] = [];
  for (const m of memberships) {
    const rows = await removeWithInvitees(tx, m.caseId, [userId]);
    removed.push({ caseId: m.caseId, userIds: rows.map((r) => r.userId) });
  }
  return removed;
}
