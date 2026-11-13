import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  auditLog,
  caseDocument,
  caseGoodsLine,
  caseMember,
  caseSubmission,
  profile,
  shipmentCase,
  user,
} from "@/db/schema";
import { isValidCaseCode, normalizeCaseCode } from "@/lib/case-id";
import { isDocType, type DocType } from "@/lib/documents";
import type { Role } from "@/lib/roles";

const consigneeMember = alias(caseMember, "consignee_member");
const consigneeUser = alias(user, "consignee_user");
const consigneeProfile = alias(profile, "consignee_profile");

const caseOwner = alias(user, "case_owner");

const consigneeOfCase = and(eq(consigneeMember.caseId, shipmentCase.id), eq(consigneeMember.role, "consignee"));

const caseRow = {
  id: shipmentCase.id,
  caseCode: shipmentCase.caseCode,
  status: shipmentCase.status,
  /** Typed-in name on older cases. */
  consigneeName: shipmentCase.consigneeName,
  consigneeUsername: consigneeUser.username,
  consigneeParty: sql<string | null>`coalesce(nullif(${consigneeProfile.organisation}, ''), ${consigneeProfile.legalName}, ${consigneeUser.name})`,
  consigneeStatus: consigneeMember.status,
  destinationCountry: shipmentCase.destinationCountry,
  exportPortCode: shipmentCase.exportPortCode,
  ownerId: shipmentCase.ownerId,
  hazmat: shipmentCase.hazmat,
  pharma: shipmentCase.pharma,
  perishable: shipmentCase.perishable,
  createdAt: shipmentCase.createdAt,
};

export type CaseRow = Awaited<ReturnType<typeof listCasesForOwner>>[number];

export async function listCasesForOwner(ownerId: string) {
  return db
    .select(caseRow)
    .from(shipmentCase)
    .leftJoin(consigneeMember, consigneeOfCase)
    .leftJoin(consigneeUser, eq(consigneeUser.id, consigneeMember.userId))
    .leftJoin(consigneeProfile, eq(consigneeProfile.userId, consigneeMember.userId))
    .where(eq(shipmentCase.ownerId, ownerId))
    .orderBy(desc(shipmentCase.createdAt));
}

/** Cases this user was invited to and accepted. */
export async function listSharedCases(userId: string) {
  return db
    .select(caseRow)
    .from(caseMember)
    .innerJoin(shipmentCase, eq(shipmentCase.id, caseMember.caseId))
    .leftJoin(consigneeMember, consigneeOfCase)
    .leftJoin(consigneeUser, eq(consigneeUser.id, consigneeMember.userId))
    .leftJoin(consigneeProfile, eq(consigneeProfile.userId, consigneeMember.userId))
    .where(and(eq(caseMember.userId, userId), eq(caseMember.status, "accepted")))
    .orderBy(desc(caseMember.respondedAt));
}

/** Invites waiting for this user to accept or decline. */
export async function listPendingInvites(userId: string) {
  return db
    .select({
      id: caseMember.id,
      createdAt: caseMember.createdAt,
      caseCode: shipmentCase.caseCode,
      exportPortCode: shipmentCase.exportPortCode,
      destinationCountry: shipmentCase.destinationCountry,
      inviterName: user.name,
      inviterUsername: user.username,
      inviterRole: user.role,
    })
    .from(caseMember)
    .innerJoin(shipmentCase, eq(shipmentCase.id, caseMember.caseId))
    .innerJoin(user, eq(user.id, caseMember.invitedBy))
    .where(and(eq(caseMember.userId, userId), eq(caseMember.status, "pending")))
    .orderBy(desc(caseMember.createdAt));
}

export type PendingInvite = Awaited<ReturnType<typeof listPendingInvites>>[number];

const inviter = alias(user, "inviter");

/** Everyone invited to a case, oldest first, with who invited them (and the profile details the consignee card needs). */
export async function listCaseMembers(caseId: string) {
  return db
    .select({
      id: caseMember.id,
      userId: caseMember.userId,
      invitedBy: caseMember.invitedBy,
      status: caseMember.status,
      createdAt: caseMember.createdAt,
      name: user.name,
      username: user.username,
      role: caseMember.role,
      inviterUsername: inviter.username,
      legalName: profile.legalName,
      organisation: profile.organisation,
      address: profile.address,
    })
    .from(caseMember)
    .innerJoin(user, eq(user.id, caseMember.userId))
    .innerJoin(inviter, eq(inviter.id, caseMember.invitedBy))
    .leftJoin(profile, eq(profile.userId, caseMember.userId))
    .where(eq(caseMember.caseId, caseId))
    .orderBy(asc(caseMember.createdAt));
}

export type CaseMemberRow = Awaited<ReturnType<typeof listCaseMembers>>[number];

/**
 * Holding a code is never enough: the user must own the case or have accepted an invite to it.
 * Everyone on the case sees everything on it. What they may add depends on their account type (lib/documents).
 */
export const getCaseForUser = cache(async (code: string, userId: string) => {
  const normalized = normalizeCaseCode(code);
  if (!isValidCaseCode(normalized)) return null;
  // One round trip: the case with this user's accepted membership, and its goods lines. The lines are
  // looked up by code so they don't wait for the case; they are thrown away unless access is confirmed below.
  const [found, lines] = await Promise.all([
    db
      .select({ c: shipmentCase, memberId: caseMember.id, ownerName: caseOwner.name, ownerUsername: caseOwner.username })
      .from(shipmentCase)
      .innerJoin(caseOwner, eq(caseOwner.id, shipmentCase.ownerId))
      .leftJoin(caseMember, and(eq(caseMember.caseId, shipmentCase.id), eq(caseMember.userId, userId), eq(caseMember.status, "accepted")))
      .where(eq(shipmentCase.caseCode, normalized)),
    db
      .select({ line: caseGoodsLine })
      .from(caseGoodsLine)
      .innerJoin(shipmentCase, eq(shipmentCase.id, caseGoodsLine.caseId))
      .where(eq(shipmentCase.caseCode, normalized))
      .orderBy(asc(caseGoodsLine.lineNo)),
  ]);
  const row = found[0];
  if (!row) return null;
  const c = row.c;
  let access: "owner" | "member";
  if (c.ownerId === userId) access = "owner";
  else if (row.memberId) access = "member";
  else return null;
  return { ...c, access, lines: lines.map((l) => l.line), owner: { name: row.ownerName, username: row.ownerUsername } };
});

/**
 * The cases for the sidebar: everything this user owns or has accepted, newest first. Deliberately light
 * (no joins to people or documents) because it loads on every signed-in page.
 */
export const listCaseNav = cache(async (userId: string) =>
  db
    .select({
      id: shipmentCase.id,
      caseCode: shipmentCase.caseCode,
      exportPortCode: shipmentCase.exportPortCode,
      destinationCountry: shipmentCase.destinationCountry,
      owned: sql<boolean>`${shipmentCase.ownerId} = ${userId}`,
    })
    .from(shipmentCase)
    .leftJoin(caseMember, and(eq(caseMember.caseId, shipmentCase.id), eq(caseMember.userId, userId), eq(caseMember.status, "accepted")))
    .where(or(eq(shipmentCase.ownerId, userId), isNotNull(caseMember.id)))
    .orderBy(desc(shipmentCase.createdAt)),
);

export type CaseNavItem = Awaited<ReturnType<typeof listCaseNav>>[number];

export type CaseForUser = NonNullable<Awaited<ReturnType<typeof getCaseForUser>>>;

/** Owner-only access, for editing the case itself. */
export async function getOwnedCase(code: string, ownerId: string) {
  const c = await getCaseForUser(code, ownerId);
  return c?.access === "owner" ? c : null;
}

export type OwnedCase = CaseForUser;

const adder = alias(user, "adder");

/**
 * Everything people have added to a case and not taken back, newest first, with who added it
 * (and in what role) and its files. `adderOnCase` is false once the adder has left the case.
 */
export async function listSubmissions(c: { id: string }) {
  const [rows, files] = await Promise.all([
    db
      .select({
        id: caseSubmission.id,
        type: caseSubmission.type,
        addedBy: caseSubmission.addedBy,
        addedByRole: caseSubmission.addedByRole,
        source: caseSubmission.source,
        documentNumber: caseSubmission.documentNumber,
        documentDate: caseSubmission.documentDate,
        normalized: caseSubmission.normalized,
        provenance: caseSubmission.provenance,
        supersedesId: caseSubmission.supersedesId,
        createdAt: caseSubmission.createdAt,
        adderName: adder.name,
        adderUsername: adder.username,
      })
      .from(caseSubmission)
      .innerJoin(adder, eq(adder.id, caseSubmission.addedBy))
      .where(and(eq(caseSubmission.caseId, c.id), isNull(caseSubmission.removedAt)))
      .orderBy(desc(caseSubmission.createdAt)),
    db.select().from(caseDocument).where(eq(caseDocument.caseId, c.id)).orderBy(asc(caseDocument.createdAt)),
  ]);
  return rows.flatMap((r) =>
    isDocType(r.type)
      ? [
          {
            ...r,
            type: r.type as DocType,
            addedByRole: r.addedByRole as Role,
            files: files.filter((f) => f.submissionId === r.id),
          },
        ]
      : [],
  );
}

type SubmissionRow = Awaited<ReturnType<typeof listSubmissions>>[number];
export type Submission = SubmissionRow & { adderOnCase: boolean };

/** Marks each document with whether its adder is still on the case (the owner or an accepted member). */
export function withAdderOnCase(rows: SubmissionRow[], c: { ownerId: string }, members: Array<{ userId: string; status: string }>): Submission[] {
  const onCase = new Set([c.ownerId, ...members.filter((m) => m.status === "accepted").map((m) => m.userId)]);
  return rows.map((r) => ({ ...r, adderOnCase: onCase.has(r.addedBy) }));
}

/**
 * The consignee linked to a case, if any, from the members already loaded. Their account details replace the
 * consignee name and address the consignor used to type in. `partyName` is what the shipping bill should show.
 */
export function consigneeOf(members: CaseMemberRow[]) {
  const m = members.find((x) => x.role === "consignee");
  if (!m) return null;
  return {
    userId: m.userId,
    status: m.status,
    name: m.name,
    username: m.username,
    legalName: m.legalName,
    organisation: m.organisation,
    address: m.address,
    partyName: m.organisation || m.legalName || m.name,
  };
}

export type CaseConsignee = NonNullable<ReturnType<typeof consigneeOf>>;

const actor = alias(user, "actor");

/** The audit trail of one case, newest first, with who did it. IP address and browser are never returned. */
export async function listCaseActivity(caseId: string, limit = 200) {
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      details: auditLog.details,
      at: auditLog.at,
      actorName: actor.name,
      actorUsername: actor.username,
      actorRole: actor.role,
    })
    .from(auditLog)
    .leftJoin(actor, eq(actor.id, auditLog.actorId))
    .where(and(eq(auditLog.entityType, "case"), eq(auditLog.entityId, caseId)))
    .orderBy(desc(auditLog.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    details: r.details,
    at: r.at,
    actor: r.actorName ? { name: r.actorName, username: r.actorUsername, role: r.actorRole } : null,
  }));
}

export type ActivityItem = Awaited<ReturnType<typeof listCaseActivity>>[number];
