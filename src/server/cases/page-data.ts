import "server-only";
import { cache } from "react";
import { caseFlow } from "@/lib/case-flow";
import { expectedDocuments } from "@/lib/documents";
import type { Role } from "@/lib/roles";
import { computeCheckReport, listCheckAcks, summarizeReport } from "./checks";
import { loadFacts } from "./facts-data";
import { consigneeOf, getCaseForUser, listCaseActivity, listCaseMembers, listSubmissions, withAdderOnCase } from "./service";

/**
 * Everything the pages of one case show: its documents, people, owner, consignee, the cross-document checks
 * and the flow. Cached for the request, so the overview, documents, checks and people pages (and the layout
 * around them) share one load. All queries run together.
 */
export const loadCasePage = cache(async (code: string, userId: string, role: Role) => {
  const c = await getCaseForUser(code, userId);
  if (!c) return null;
  // The case query already brought the owner; everything else is independent, so it all loads at once.
  const [members, rows, acks, factMap, activity] = await Promise.all([listCaseMembers(c.id), listSubmissions(c), listCheckAcks(c.id), loadFacts([c.id]), listCaseActivity(c.id)]);
  const submissions = withAdderOnCase(rows, c, members);
  const consignee = consigneeOf(members);
  const owner = c.owner;
  const facts = factMap.get(c.id) ?? [];
  const report = computeCheckReport({ case: c, consigneeParty: consignee?.partyName ?? null, ownerName: owner.name, submissions, acks, facts });
  const flow = caseFlow({
    role,
    members: members.length,
    consigneeLinked: consignee != null,
    docTypes: submissions.map((s) => s.type),
    needs: expectedDocuments(c),
    issues: summarizeReport(report, submissions.length, role),
  });
  return { c, submissions, members, owner, consignee, report, flow, facts, activity };
});

export type CasePage = NonNullable<Awaited<ReturnType<typeof loadCasePage>>>;
