import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { caseSubmission, checkAck, user } from "@/db/schema";
import { runChecks } from "@/lib/checks/engine";
import type { CheckAck, CheckReport } from "@/lib/checks/types";
import type { Role } from "@/lib/roles";
import { getCaseConsignee, getCaseForUser, getUserHandle, listSubmissions, type CaseConsignee, type CaseForUser, type Submission } from "./service";

export async function listCheckAcks(caseId: string): Promise<CheckAck[]> {
  const rows = await db
    .select({ checkKey: checkAck.checkKey, valuesKey: checkAck.valuesKey, note: checkAck.note, byName: user.name, at: checkAck.createdAt })
    .from(checkAck)
    .innerJoin(user, eq(user.id, checkAck.userId))
    .where(eq(checkAck.caseId, caseId))
    .orderBy(desc(checkAck.createdAt));
  return rows;
}

/** The cross-document checks for a case, from what is already loaded for the page plus its acknowledgements. */
export async function getCheckReport(
  c: CaseForUser,
  submissions: Submission[],
  consignee: CaseConsignee | null,
  ownerName: string,
): Promise<CheckReport> {
  const acks = await listCheckAcks(c.id);
  return runChecks({
    caseRecord: {
      exportPortCode: c.exportPortCode,
      consigneeName: consignee?.partyName ?? c.consigneeName ?? null,
      lines: c.lines.map((l) => ({ hsCode: l.hsCode, packages: l.packages, grossWeight: Number(l.grossWeight), weightUnit: l.weightUnit })),
    },
    caseOwner: { role: "consignor", name: ownerName },
    submissions: submissions.map((s) => ({
      id: s.id,
      type: s.type,
      addedByRole: s.addedByRole,
      adderName: s.adderName,
      documentNumber: s.documentNumber,
      normalized: s.normalized,
    })),
    acks,
  });
}

/**
 * A document the viewer added and can correct: still current, on this case, and with a saved form.
 * Returns the form as typed so the correction starts from it.
 */
export async function getOwnSubmissionForCorrection(caseId: string, submissionId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) return null;
  const [row] = await db
    .select({ id: caseSubmission.id, type: caseSubmission.type, raw: caseSubmission.raw, addedBy: caseSubmission.addedBy })
    .from(caseSubmission)
    .where(and(eq(caseSubmission.id, submissionId), eq(caseSubmission.caseId, caseId), isNull(caseSubmission.removedAt)));
  if (!row || row.addedBy !== userId) return null;
  const raw = row.raw as { form?: Record<string, unknown> } | null;
  return raw?.form ? { id: row.id, type: row.type, form: raw.form } : null;
}

export type CheckSummary = { documents: number; toFix: number; worthALook: number; forYou: number };

/** Open issues on one case, for the dashboard. "forYou" counts those the viewer's account type can fix. */
export async function summarizeChecks(caseCode: string, viewer: { id: string; role: Role }): Promise<CheckSummary | null> {
  const c = await getCaseForUser(caseCode, viewer.id);
  if (!c) return null;
  const [submissions, consignee, owner] = await Promise.all([listSubmissions(c), getCaseConsignee(c.id), getUserHandle(c.ownerId)]);
  const r = await getCheckReport(c, submissions, consignee, owner?.name ?? "Consignor");
  const open = [...r.containers.flatMap((x) => x.results), ...r.caseChecks].filter(
    (x) => (x.status === "mismatch" || x.status === "invalid" || x.status === "warning") && !x.acknowledged,
  );
  return {
    documents: submissions.length,
    toFix: open.filter((x) => x.status !== "warning").length,
    worthALook: open.filter((x) => x.status === "warning").length,
    forYou: open.filter((x) => x.owners.includes(viewer.role)).length,
  };
}
