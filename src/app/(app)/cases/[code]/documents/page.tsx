import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/session";
import { loadCasePage } from "@/server/cases/page-data";
import { DocumentsTab } from "../documents-tab";

type Props = { params: Promise<{ code: string }> };

/** Everything everyone has added to the case, grouped by document type. */
export default async function CaseDocumentsPage({ params }: Props) {
  const { code } = await params;
  const user = await requireOnboardedUser();
  const data = await loadCasePage(code, user.id, user.role);
  if (!data) notFound();
  if (data.c.caseCode !== code) redirect(`/cases/${data.c.caseCode}/documents`);
  return <DocumentsTab c={data.c} submissions={data.submissions} viewer={{ id: user.id, role: user.role }} issues={data.report.bySubmission} />;
}
