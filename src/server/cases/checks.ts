import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { caseSubmission, checkAck, user } from "@/db/schema";
import { runChecks } from "@/lib/checks/engine";
import { currentDateIst } from "@/lib/format";
import type { CheckAck, CheckReport, FactKey } from "@/lib/checks/types";
import type { DocType } from "@/lib/documents";
import type { FactView } from "@/lib/facts/ladder";
import type { Role } from "@/lib/roles";

export async function listCheckAcks(caseId: string): Promise<CheckAck[]> {
  const rows = await db
    .select({ checkKey: checkAck.checkKey, valuesKey: checkAck.valuesKey, note: checkAck.note, byName: user.name, at: checkAck.createdAt, self: checkAck.self })
    .from(checkAck)
    .innerJoin(user, eq(user.id, checkAck.userId))
    .where(eq(checkAck.caseId, caseId))
    .orderBy(desc(checkAck.createdAt));
  return rows;
}

/** What the checks need to know about one case and everything on it. Already loaded by the caller. */
export type CheckInput = {
  case: {
    exportPortCode: string;
    /** Typed in on cases made before consignees had accounts. */
    consigneeName: string | null;
    lines: Array<{ hsCode: string; packages: number; grossWeight: unknown; weightUnit: string }>;
  };
  /** The linked consignee's name on the shipping bill, when there is one. */
  consigneeParty: string | null;
  ownerId: string;
  ownerName: string;
  submissions: Array<{ id: string; type: DocType; addedBy: string; addedByRole: Role; adderName: string; documentNumber: string | null; normalized: unknown; signedFacts?: FactKey[] }>;
  acks: CheckAck[];
  /** Verified values on the case; documents are compared with these first. */
  facts?: FactView[];
};

/**
 * The verified values a signed document backs, raised to "signed" for display. The checks work this out per
 * fact; the Verified info list and the badges read it from here so both say the same thing.
 */
export function withSignedLevels(facts: FactView[], report: CheckReport): FactView[] {
  const signed = new Set(
    [...report.containers.flatMap((c) => c.results), ...report.caseChecks].flatMap((r) => (r.verified?.level === "source_verified" ? [r.verified.factId] : [])),
  );
  return facts.map((f) => (signed.has(f.id) && f.level !== "observed" ? { ...f, level: "source_verified" } : f));
}

/** The cross-document checks for one case. Pure: the page and the dashboard both feed it what they have loaded. */
export function computeCheckReport(i: CheckInput): CheckReport {
  return runChecks({
    caseRecord: {
      exportPortCode: i.case.exportPortCode,
      consigneeName: i.consigneeParty ?? i.case.consigneeName ?? null,
      lines: i.case.lines.map((l) => ({ hsCode: l.hsCode, packages: l.packages, grossWeight: Number(l.grossWeight), weightUnit: l.weightUnit })),
    },
    caseOwner: { id: i.ownerId, role: "consignor", name: i.ownerName },
    submissions: i.submissions.map((s) => ({
      id: s.id,
      type: s.type,
      addedByRole: s.addedByRole,
      addedBy: s.addedBy,
      adderName: s.adderName,
      signedFacts: s.signedFacts,
      documentNumber: s.documentNumber,
      normalized: s.normalized,
    })),
    acks: i.acks,
    facts: i.facts,
    today: currentDateIst(),
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

export type CheckSummary = { documents: number; toFix: number; worthALook: number; forYou: number; onePaper: number };

/** Open issues in one report, for the dashboard. "forYou" counts those the viewer's account type can fix. */
export function summarizeReport(report: CheckReport, documents: number, viewerRole: Role): CheckSummary {
  const open = [...report.containers.flatMap((x) => x.results), ...report.caseChecks].filter(
    (x) => (x.status === "mismatch" || x.status === "invalid" || x.status === "warning") && !x.acknowledged,
  );
  return {
    documents,
    toFix: open.filter((x) => x.status !== "warning").length,
    worthALook: open.filter((x) => x.status === "warning").length,
    forYou: open.filter((x) => x.owners.includes(viewerRole)).length,
    onePaper: report.counts.single,
  };
}
