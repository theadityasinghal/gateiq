import "server-only";
import { cache } from "react";
import { caseFlow } from "@/lib/case-flow";
import { expectedDocuments } from "@/lib/documents";
import type { Role } from "@/lib/roles";
import { computeCheckReport, listCheckAcks, summarizeReport } from "./checks";
import { getCaseConsignee, getCaseForUser, getUserHandle, listCaseMembers, listSubmissions } from "./service";

/**
 * Everything the pages of one case show: its documents, people, owner, consignee, the cross-document checks
 * and the flow. Cached for the request, so the overview, documents, checks and people pages (and the layout
 * around them) share one load. All queries run together.
 */
export const loadCasePage = cache(async (code: string, userId: string, role: Role) => {
  const c = await getCaseForUser(code, userId);
  if (!c) return null;
  const [submissions, members, owner, consignee, acks] = await Promise.all([
    listSubmissions(c),
    listCaseMembers(c.id),
    getUserHandle(c.ownerId),
    getCaseConsignee(c.id),
    listCheckAcks(c.id),
  ]);
  const report = computeCheckReport({ case: c, consigneeParty: consignee?.partyName ?? null, ownerName: owner?.name ?? "Consignor", submissions, acks });
  const flow = caseFlow({
    role,
    members: members.length,
    consigneeLinked: consignee != null,
    docTypes: submissions.map((s) => s.type),
    needs: expectedDocuments(c),
    issues: summarizeReport(report, submissions.length, role),
  });
  return { c, submissions, members, owner, consignee, report, flow };
});

export type CasePage = NonNullable<Awaited<ReturnType<typeof loadCasePage>>>;
