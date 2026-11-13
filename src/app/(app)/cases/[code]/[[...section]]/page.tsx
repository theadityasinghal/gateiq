import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/session";
import { loadCasePage } from "@/server/cases/page-data";
import { invitableRoles, ROLE_INFO, isReadOnly } from "@/lib/roles";
import { CASE_SECTIONS, sectionFromSegments } from "@/lib/case-sections";
import { buildVerifiedSections } from "@/lib/facts/rows";
import { CaseSections } from "../case-sections";
import { OverviewPanel } from "../overview-panel";
import { VerifiedPanel } from "../verified-panel";
import { DocumentsTab } from "../documents-tab";
import { ChecksTab } from "../checks-tab";
import { PeopleCard } from "../people-card";
import { ActivityPanel } from "../activity-panel";
import { DeleteCaseCard } from "../delete-case-card";

type Props = { params: Promise<{ code: string; section?: string[] }>; searchParams: Promise<{ tab?: string; upload?: string }> };

/** Where the old `?tab=` links of the one-page case now live. */
const LEGACY_TAB: Record<string, string> = { documents: "documents", filing: "documents", checks: "checks" };

/**
 * One page for all six sections of a case. It loads the case once and renders every section; the sections
 * switch on the client without asking the server again (see CaseSections).
 */
export default async function CasePage({ params, searchParams }: Props) {
  const [{ code, section }, { tab, upload }] = await Promise.all([params, searchParams]);
  const key = sectionFromSegments(section);
  if (!key) notFound();
  const user = await requireOnboardedUser();
  const data = await loadCasePage(code, user.id, user.role);
  if (!data) notFound();
  const { c, submissions, members, owner, consignee, report, flow, facts, activity } = data;
  if (tab && LEGACY_TAB[tab]) redirect(`/cases/${c.caseCode}/${LEGACY_TAB[tab]}`);
  if (c.caseCode !== code) redirect(`/cases/${c.caseCode}${CASE_SECTIONS.find((s) => s.key === key)!.path}`);

  const me = { id: user.id, name: user.name, role: user.role };
  const readOnly = isReadOnly(user.role);
  const invitable = invitableRoles(user.role);

  const panels = {
    overview: <OverviewPanel c={c} consignee={consignee} flow={flow} uploadFailed={upload === "failed"} footer={c.access === "owner" ? <DeleteCaseCard caseCode={c.caseCode} /> : null} />,
    verified: <VerifiedPanel caseCode={c.caseCode} sections={buildVerifiedSections(report, facts, me, c.access)} me={me} readOnly={readOnly} />,
    documents: <DocumentsTab c={c} submissions={submissions} viewer={{ id: user.id, role: user.role }} issues={report.bySubmission} />,
    checks: <ChecksTab caseCode={c.caseCode} report={report} viewer={me} facts={facts} />,
    people: (
      <PeopleCard
        caseCode={c.caseCode}
        viewer={{ id: user.id, username: user.username }}
        isOwner={c.access === "owner"}
        owner={owner}
        members={members}
        canInvite={invitable.length > 0}
        invitable={invitable.map((r) => ROLE_INFO[r].label)}
      />
    ),
    activity: <ActivityPanel items={activity} viewerUsername={user.username} />,
  };
  return <CaseSections caseCode={c.caseCode} panels={panels} />;
}
