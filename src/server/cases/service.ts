import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
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

/** Everyone invited to a case, oldest first, with who invited them. */
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
    })
    .from(caseMember)
    .innerJoin(user, eq(user.id, caseMember.userId))
    .innerJoin(inviter, eq(inviter.id, caseMember.invitedBy))
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
      .select({ c: shipmentCase, memberId: caseMember.id })
      .from(shipmentCase)
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
  return { ...c, access, lines: lines.map((l) => l.line) };
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
export async function listSubmissions(c: { id: string; ownerId: string }) {
  const [rows, files, members] = await Promise.all([
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
    db
      .select({ userId: caseMember.userId })
      .from(caseMember)
      .where(and(eq(caseMember.caseId, c.id), eq(caseMember.status, "accepted"))),
  ]);
  const onCase = new Set([c.ownerId, ...members.map((m) => m.userId)]);
  return rows.flatMap((r) =>
    isDocType(r.type)
      ? [
          {
            ...r,
            type: r.type as DocType,
            addedByRole: r.addedByRole as Role,
            adderOnCase: onCase.has(r.addedBy),
            files: files.filter((f) => f.submissionId === r.id),
          },
        ]
      : [],
  );
}

export type Submission = Awaited<ReturnType<typeof listSubmissions>>[number];

/** Name and username, for showing who owns a case. */
export async function getUserHandle(userId: string) {
  const [u] = await db.select({ name: user.name, username: user.username }).from(user).where(eq(user.id, userId));
  return u ?? null;
}

/**
 * The consignee linked to a case, if any. Their account details replace the consignee name and
 * address the consignor used to type in. `partyName` is what the shipping bill should show.
 */
export async function getCaseConsignee(caseId: string) {
  const [m] = await db
    .select({
      userId: caseMember.userId,
      status: caseMember.status,
      name: user.name,
      username: user.username,
      legalName: profile.legalName,
      organisation: profile.organisation,
      address: profile.address,
    })
    .from(caseMember)
    .innerJoin(user, eq(user.id, caseMember.userId))
    .leftJoin(profile, eq(profile.userId, caseMember.userId))
    .where(and(eq(caseMember.caseId, caseId), eq(caseMember.role, "consignee")));
  if (!m) return null;
  return { ...m, partyName: m.organisation || m.legalName || m.name };
}

export type CaseConsignee = NonNullable<Awaited<ReturnType<typeof getCaseConsignee>>>;
