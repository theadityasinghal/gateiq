import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireOnboardedUser } from "@/server/session";
import {
  getCaseConsignee,
  getCaseForUser,
  getUserHandle,
  listCaseMembers,
  listSubmissions,
  type CaseConsignee,
  type CaseForUser,
  type CaseMemberRow,
} from "@/server/cases/service";
import { removeMember } from "@/server/cases/members";
import { ROLE_INFO, invitableRoles } from "@/lib/roles";
import { InviteForm } from "./invite-form";
import { DocumentsTab } from "./documents-tab";
import { ChecksTab } from "./checks-tab";
import { computeCheckReport, listCheckAcks, summarizeReport } from "@/server/cases/checks";
import { caseFlow } from "@/lib/case-flow";
import { expectedDocuments } from "@/lib/documents";
import { FlowStrip } from "@/components/flow-strip";
import { CASE_STATUS_LABEL, countryName, formatDate } from "@/lib/format";
import { normalizeCaseCode } from "@/lib/case-id";
import { SegmentedTabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { ArrowRight, Package, Route, TriangleExclamationPoint, Users } from "lucide-react";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ tab?: string; upload?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: normalizeCaseCode(code) };
}

export default async function CasePage({ params, searchParams }: Props) {
  const [{ code }, { tab = "product", upload }] = await Promise.all([params, searchParams]);
  const user = await requireOnboardedUser();
  const c = await getCaseForUser(code, user.id);
  if (!c) notFound();
  const isOwner = c.access === "owner";
  if (c.caseCode !== code) redirect(`/cases/${c.caseCode}${tab ? `?tab=${tab}` : ""}`);

  const [submissions, members, owner, consignee, acks] = await Promise.all([
    listSubmissions(c),
    listCaseMembers(c.id),
    getUserHandle(c.ownerId),
    getCaseConsignee(c.id),
    listCheckAcks(c.id),
  ]);
  const report = computeCheckReport({ case: c, consigneeParty: consignee?.partyName ?? null, ownerName: owner?.name ?? "Consignor", submissions, acks });
  const openIssues = report.counts.mismatch + report.counts.invalid + report.counts.warning;
  const flow = caseFlow({
    role: user.role,
    members: members.length,
    consigneeLinked: consignee != null,
    docTypes: submissions.map((s) => s.type),
    needs: expectedDocuments(c),
    issues: summarizeReport(report, submissions.length, user.role),
  });
  // "filing" was the tab's old name; old links still land on it.
  const active = tab === "documents" || tab === "filing" ? "documents" : tab === "checks" ? "checks" : "product";
  const base = `/cases/${c.caseCode}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-micro-upper text-steel">Case ID</p>
          <h1 className="mt-2 font-mono text-[28px] font-semibold tracking-[-0.5px] sm:text-h2">{c.caseCode}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Tag tone={c.status === "filed_baseline_ready" ? "green" : "orange"}>{CASE_STATUS_LABEL[c.status]}</Tag>
            <span className="text-caption text-steel">Created {formatDate(c.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CopyButton value={c.caseCode} label="Copy Case ID" />
        </div>
      </div>

      <Card>
        <FlowStrip steps={flow.steps} />
        <p className="mt-4 flex items-start gap-2 text-body-sm text-charcoal">
          <ArrowRight size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-steel" aria-hidden="true" />
          <span><span className="font-medium">Next for you:</span> {flow.next}</span>
        </p>
        {flow.missing.length ? (
          <p className="mt-1 pl-6 text-caption text-steel">Still expected: {flow.missing.map((n) => n.label.toLowerCase()).join(", ")}.</p>
        ) : null}
      </Card>

      <People
        caseCode={c.caseCode}
        viewerId={user.id}
        isOwner={isOwner}
        owner={owner ?? { name: "Unknown", username: null }}
        members={members}
        canInvite={invitableRoles(user.role).length > 0}
        invitable={invitableRoles(user.role).map((r) => ROLE_INFO[r].label)}
      />

      {upload === "failed" ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-tag-red-bg p-4 text-body-sm text-tag-red-fg">
          <TriangleExclamationPoint size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>The case was created, but a document failed to upload. Check the storage settings and try again.</span>
        </p>
      ) : null}

      <SegmentedTabs
        active={active}
        tabs={[
          { key: "product", label: "Product info", href: `${base}?tab=product` },
          { key: "documents", label: "Documents", href: `${base}?tab=documents`, count: submissions.length },
          { key: "checks", label: "Checks", href: `${base}?tab=checks`, count: openIssues || undefined },
        ]}
      />

      {active === "product" ? <ProductTab c={c} consignee={consignee} /> : null}
      {active === "documents" ? (
        <DocumentsTab c={c} submissions={submissions} viewer={{ id: user.id, role: user.role }} issues={report.bySubmission} />
      ) : null}
      {active === "checks" ? <ChecksTab caseCode={c.caseCode} report={report} /> : null}
    </div>
  );
}

function People({
  caseCode,
  viewerId,
  isOwner,
  owner,
  members,
  canInvite,
  invitable,
}: {
  caseCode: string;
  viewerId: string;
  isOwner: boolean;
  owner: { name: string; username: string | null };
  members: CaseMemberRow[];
  canInvite: boolean;
  invitable: string[];
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-h5"><Users size={20} strokeWidth={1.8} className="text-steel" aria-hidden="true" />People on this case</h2>
          <p className="text-body-sm text-slate">Everyone here sees the whole case and everything anyone adds to it. What each person can add depends on their account type.</p>
        </div>
      </div>
      <ul className="divide-y divide-hairline-soft">
        <li className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-charcoal">
              {owner.name} {owner.username ? <span className="font-mono text-steel">@{owner.username}</span> : null}
            </p>
            <p className="text-caption text-steel">{ROLE_INFO.consignor.label} · owner</p>
          </div>
          <Tag tone="purple">Owner</Tag>
        </li>
        {members.map((m) => {
          const canRemove = isOwner || m.invitedBy === viewerId;
          return (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-charcoal">
                  {m.name} <span className="font-mono text-steel">@{m.username}</span>
                  {m.userId === viewerId ? <span className="text-steel"> (you)</span> : null}
                </p>
                <p className="text-caption text-steel">
                  {ROLE_INFO[m.role].label} · invited by @{m.inviterUsername} on {formatDate(m.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tag tone={m.status === "accepted" ? "green" : "orange"}>{m.status === "accepted" ? "Accepted" : "Invited"}</Tag>
                {canRemove ? (
                  <form action={removeMember}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <button type="submit" className="min-h-10 rounded-sm px-3 py-2 text-[14px] font-medium text-error active:bg-surface">
                      {m.status === "pending" ? "Cancel invite" : "Remove"}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {canInvite ? (
        <div className="mt-4 border-t border-hairline-soft pt-4">
          <InviteForm caseCode={caseCode} invitable={invitable} />
        </div>
      ) : null}
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-steel">{label}</dt>
      <dd className="mt-0.5 text-[15px] text-charcoal">{children}</dd>
    </div>
  );
}

function ConsigneeCard({ c, consignee }: { c: CaseForUser; consignee: CaseConsignee | null }) {
  if (consignee) {
    return (
      <Card>
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-h5">Consignee</h2>
          <Tag tone={consignee.status === "accepted" ? "green" : "orange"}>{consignee.status === "accepted" ? "Linked" : "Invited"}</Tag>
        </div>
        <dl className="space-y-3">
          <Detail label="Name on the shipping bill">{consignee.partyName}</Detail>
          <Detail label="Account">
            {consignee.name} <span className="font-mono text-steel">@{consignee.username}</span>
          </Detail>
          {consignee.address ? (
            <Detail label="Address"><span className="whitespace-pre-line">{consignee.address}</span></Detail>
          ) : null}
        </dl>
        {consignee.status === "pending" ? (
          <p className="mt-4 text-caption text-steel">Waiting for @{consignee.username} to accept. Until then the consignee isn&apos;t compared with the filing.</p>
        ) : null}
      </Card>
    );
  }
  if (c.consigneeName) {
    // Cases made before consignees had accounts.
    return (
      <Card>
        <h2 className="mb-4 text-h5">Consignee</h2>
        <dl className="space-y-3">
          <Detail label="Name">{c.consigneeName}</Detail>
          {c.consigneeAddress ? <Detail label="Address"><span className="whitespace-pre-line">{c.consigneeAddress}</span></Detail> : null}
          {c.consigneeCountry ? <Detail label="Country">{countryName(c.consigneeCountry)}</Detail> : null}
        </dl>
        <p className="mt-4 text-caption text-steel">Typed in when the case was created. Invite the consignee by username to link their account.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h2 className="mb-2 text-h5">Consignee</h2>
      <p className="text-body-sm text-slate">
        {c.access === "owner"
          ? "Not invited yet. Invite your consignee by username in People on this case above."
          : "The consignor hasn't invited the consignee yet."}
      </p>
    </Card>
  );
}

function ProductTab({ c, consignee }: { c: CaseForUser; consignee: CaseConsignee | null }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <ConsigneeCard c={c} consignee={consignee} />
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-h5"><Route size={20} strokeWidth={1.8} className="text-steel" aria-hidden="true" />Route and terms</h2>
          <dl className="grid grid-cols-2 gap-3">
            <Detail label="Origin">{c.originPlace}</Detail>
            <Detail label="Port of export"><span className="font-mono">{c.exportPortCode}</span></Detail>
            <Detail label="Destination">{countryName(c.destinationCountry)}{c.destinationPort ? `, ${c.destinationPort}` : ""}</Detail>
            <Detail label="Incoterm · currency">{c.incoterm} · {c.currency}</Detail>
          </dl>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-md border border-hairline">
        <table className="w-full min-w-[760px] text-left text-body-sm">
          <thead className="bg-surface-soft text-caption text-steel">
            <tr>
              {["#", "Description", "HS code", "Quantity", "Packages", "Net / gross", `Value (${c.currency})`].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.lines.map((l) => (
              <tr key={l.id} className="border-t border-hairline-soft">
                <td className="px-4 py-3 text-steel">{l.lineNo}</td>
                <td className="px-4 py-3 text-charcoal">{l.description}</td>
                <td className="px-4 py-3 font-mono">{l.hsCode}</td>
                <td className="px-4 py-3">{Number(l.quantity)} {l.uqc}</td>
                <td className="px-4 py-3">{l.packages} {l.packageType}</td>
                <td className="px-4 py-3">{Number(l.netWeight)} / {Number(l.grossWeight)} {l.weightUnit}</td>
                <td className="px-4 py-3">{Number(l.value).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {c.hazmat || c.pharma || c.perishable ? (
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-h5"><Package size={20} strokeWidth={1.8} className="text-steel" aria-hidden="true" />Special cargo</h2>
          <div className="flex flex-wrap gap-2">
            {c.hazmat ? <Tag tone="orange">Hazardous · {c.hazmat.unNumber} · Class {c.hazmat.hazardClass}</Tag> : null}
            {c.pharma ? <Tag tone="sky">Temperature {c.pharma.minC}°C to {c.pharma.maxC}°C</Tag> : null}
            {c.perishable ? <Tag tone="green">Perishable · {c.perishable.certificateType}</Tag> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
