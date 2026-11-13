import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/session";
import { loadCasePage } from "@/server/cases/page-data";
import { ChecksTab } from "../checks-tab";

type Props = { params: Promise<{ code: string }> };

/** Where the documents agree and where they don't. */
export default async function CaseChecksPage({ params }: Props) {
  const { code } = await params;
  const user = await requireOnboardedUser();
  const data = await loadCasePage(code, user.id, user.role);
  if (!data) notFound();
  if (data.c.caseCode !== code) redirect(`/cases/${data.c.caseCode}/checks`);
  return <ChecksTab caseCode={data.c.caseCode} report={data.report} />;
}
