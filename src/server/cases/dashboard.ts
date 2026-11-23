import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { signedFactsOf } from "@/lib/qr/signed";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { caseGoodsLine, caseMember, caseSubmission, checkAck, user } from "@/db/schema";
import { caseFlow, type CaseFlow } from "@/lib/case-flow";
import { expectedDocuments, isDocType, type DocType } from "@/lib/documents";
import type { Role } from "@/lib/roles";
import { computeCheckReport, summarizeReport, type CheckSummary } from "./checks";
import { loadFacts } from "./facts-data";
import type { CaseRow } from "./service";

export type DashboardCase = { summary: CheckSummary; flow: CaseFlow };

const adder = alias(user, "adder");

/**
 * Check counts and flow state for every case on the dashboard, from six queries (seven counting the verified values' confirmations) however many cases there
 * are. (Loading each case on its own took about nine queries per case.) The checks themselves are the same
 * pure engine the case page uses.
 */
export async function loadDashboardCases(viewer: { role: Role }, cases: CaseRow[]): Promise<Record<string, DashboardCase>> {
  if (!cases.length) return {};
  const ids = cases.map((c) => c.id);
  const ownerIds = [...new Set(cases.map((c) => c.ownerId))];

  const [lines, subs, acks, members, owners, facts] = await Promise.all([
    db.select().from(caseGoodsLine).where(inArray(caseGoodsLine.caseId, ids)),
    db
      .select({
        id: caseSubmission.id,
        caseId: caseSubmission.caseId,
        type: caseSubmission.type,
        addedBy: caseSubmission.addedBy,
        addedByRole: caseSubmission.addedByRole,
        documentNumber: caseSubmission.documentNumber,
        normalized: caseSubmission.normalized,
        adderName: adder.name,
        signed: sql<unknown>`${caseSubmission.raw}->'signed'`,
      })
      .from(caseSubmission)
      .innerJoin(adder, eq(adder.id, caseSubmission.addedBy))
      .where(and(inArray(caseSubmission.caseId, ids), isNull(caseSubmission.removedAt))),
    db
      .select({ caseId: checkAck.caseId, checkKey: checkAck.checkKey, valuesKey: checkAck.valuesKey, note: checkAck.note, byName: user.name, at: checkAck.createdAt, self: checkAck.self })
      .from(checkAck)
      .innerJoin(user, eq(user.id, checkAck.userId))
      .where(inArray(checkAck.caseId, ids)),
    db.select({ caseId: caseMember.caseId }).from(caseMember).where(inArray(caseMember.caseId, ids)),
    db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ownerIds)),
    loadFacts(ids),
  ]);

  const ownerName = new Map(owners.map((o) => [o.id, o.name]));
  const out: Record<string, DashboardCase> = {};
  for (const c of cases) {
    const submissions = subs.filter((s) => s.caseId === c.id && isDocType(s.type)).map((s) => ({ ...s, type: s.type as DocType, addedByRole: s.addedByRole as Role, signedFacts: signedFactsOf({ signed: s.signed }) }));
    const report = computeCheckReport({
      case: { exportPortCode: c.exportPortCode, consigneeName: c.consigneeName, lines: lines.filter((l) => l.caseId === c.id) },
      consigneeParty: c.consigneeParty,
      ownerId: c.ownerId,
      ownerName: ownerName.get(c.ownerId) ?? "Consignor",
      submissions,
      acks: acks.filter((a) => a.caseId === c.id),
      facts: facts.get(c.id) ?? [],
    });
    const summary = summarizeReport(report, submissions.length, viewer.role);
    const flow = caseFlow({
      role: viewer.role,
      members: members.filter((m) => m.caseId === c.id).length,
      consigneeLinked: c.consigneeUsername != null,
      consigneeNamed: Boolean(c.consigneeName || c.consigneeParty),
      docTypes: submissions.map((s) => s.type),
      needs: expectedDocuments({ ...c, lines: lines.filter((l) => l.caseId === c.id) }),
      issues: summary,
    });
    out[c.id] = { summary, flow };
  }
  return out;
}
