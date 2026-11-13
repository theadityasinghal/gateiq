import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireOnboardedUser } from "@/server/session";
import { getCaseForUser } from "@/server/cases/service";
import { CASE_STATUS_LABEL, formatDate } from "@/lib/format";
import { isReadOnly } from "@/lib/roles";
import { normalizeCaseCode } from "@/lib/case-id";
import { Tag } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { CaseSubnav } from "./case-subnav";

type Props = { children: React.ReactNode; params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { code } = await params;
  return { title: normalizeCaseCode(code) };
}

/**
 * What every page of a case shares: the Case ID with its status, and (on narrow screens) the four sections as
 * tabs. The sidebar carries the same sections on wide ones. The case is looked up once and cached for the pages below.
 */
export default async function CaseLayout({ children, params }: Props) {
  const { code } = await params;
  const user = await requireOnboardedUser();
  const c = await getCaseForUser(code, user.id);
  if (!c) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-micro-upper text-steel">Case ID</p>
          <h1 className="mt-2 font-mono text-[28px] font-semibold tracking-[-0.5px] sm:text-h2">{c.caseCode}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag tone={c.status === "filed_baseline_ready" ? "green" : "orange"}>{CASE_STATUS_LABEL[c.status]}</Tag>
            {isReadOnly(user.role) ? <Tag tone="gray" title="Your account type can see everything on this case but change nothing">View only</Tag> : null}
            <span className="text-caption text-steel">Created {formatDate(c.createdAt)}</span>
          </div>
        </div>
        <CopyButton value={c.caseCode} label="Copy Case ID" />
      </div>
      <CaseSubnav caseCode={c.caseCode} />
      {children}
    </div>
  );
}
