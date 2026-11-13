import Link from "next/link";
import { requireOnboardedUser } from "@/server/session";
import { listCasesForOwner, listPendingInvites, listSharedCases, type CaseRow, type PendingInvite } from "@/server/cases/service";
import { loadDashboardCases, type DashboardCase } from "@/server/cases/dashboard";
import { respondToInvite } from "@/server/cases/members";
import type { CheckSummary } from "@/server/cases/checks";
import { ArrowRight, Check, Info, Mail, PackageOpen, Plus, Wrench, X } from "lucide-react";
import { StatusCount, StatusIcon } from "@/components/ui/status";
import { ROLE_INFO } from "@/lib/roles";
import { Button, ButtonLink } from "@/components/ui/button";
import { tintBg } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { FlowStrip } from "@/components/flow-strip";
import { countryName, formatDate } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const info = ROLE_INFO[user.role];
  const isOwner = user.role === "consignor";
  // The invites and the cases are independent; the per-case flow and checks then load for all cases in one go.
  const [invites, cases] = await Promise.all([listPendingInvites(user.id), isOwner ? listCasesForOwner(user.id) : listSharedCases(user.id)]);
  const progress = await loadDashboardCases({ role: user.role }, cases);

  return (
    <div className="animate-rise space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-micro-upper text-steel">{info.label}</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">
            {isOwner ? "Your cases" : `Welcome, ${user.name.split(" ")[0]}`}
          </h1>
        </div>
        {isOwner ? <ButtonLink href="/cases/new"><Plus size={16} strokeWidth={2} aria-hidden="true" />New case</ButtonLink> : null}
      </div>

      {invites.length ? <Invitations invites={invites} /> : null}

      {isOwner ? <OwnCases cases={cases} progress={progress} /> : <SharedCases cases={cases} progress={progress} tint={tintBg[info.tint]} />}
    </div>
  );
}

function Invitations({ invites }: { invites: PendingInvite[] }) {
  return (
    <section aria-labelledby="invites-heading" className="rounded-lg border border-hairline bg-canvas p-6">
      <div className="mb-4 flex items-center gap-2">
        <Mail size={20} strokeWidth={1.8} className="text-steel" aria-hidden="true" />
        <h2 id="invites-heading" className="text-h5">Invitations</h2>
        <Tag tone="orange">{invites.length}</Tag>
      </div>
      <ul className="divide-y divide-hairline-soft">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[15px] font-medium text-charcoal">{i.caseCode}</p>
              <p className="text-caption text-steel">
                {i.inviterName} <span className="font-mono">@{i.inviterUsername}</span>
                {i.inviterRole ? ` (${ROLE_INFO[i.inviterRole].label})` : ""} invited you · {i.exportPortCode} <ArrowRight size={12} className="inline" aria-label="to" role="img" /> {countryName(i.destinationCountry)} ·{" "}
                {formatDate(i.createdAt)}
              </p>
            </div>
            <form action={respondToInvite} className="flex gap-2">
              <input type="hidden" name="memberId" value={i.id} />
              <Button type="submit" name="decision" value="decline" variant="secondary"><X size={16} strokeWidth={2} aria-hidden="true" />Decline</Button>
              <Button type="submit" name="decision" value="accept"><Check size={16} strokeWidth={2} aria-hidden="true" />Accept</Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Progress = Record<string, DashboardCase>;

function OwnCases({ cases, progress }: { cases: CaseRow[]; progress: Progress }) {
  if (!cases.length) {
    return (
      <div className="rounded-lg bg-surface p-10 text-center">
        <PackageOpen size={40} strokeWidth={1.4} className="mx-auto mb-3 text-steel" aria-hidden="true" />
        <h2 className="text-h4">No cases yet</h2>
        <p className="mx-auto mt-2 max-w-[480px] text-slate">
          Create a case for each consignment. You&apos;ll get a Case ID, and you can invite your consignee, CHA and transporter to it.
        </p>
        <ButtonLink href="/cases/new" className="mt-6"><Plus size={16} strokeWidth={2} aria-hidden="true" />Create your first case</ButtonLink>
      </div>
    );
  }
  return <CaseTable cases={cases} progress={progress} />;
}

function SharedCases({ cases, progress, tint }: { cases: CaseRow[]; progress: Progress; tint: string }) {
  return (
    <section className="space-y-4">
      <h2 className="text-h4">Cases shared with you</h2>
      {cases.length ? (
        <CaseTable cases={cases} progress={progress} />
      ) : (
        <div className={`${tint} rounded-lg p-8 text-charcoal`}>
          <p className="flex max-w-[640px] items-start gap-2 text-body-sm">
            <Info size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>When someone invites you to a case, the invite shows up here. Once you accept, you can view the case. Give them your username so they can find you.</span>
          </p>
        </div>
      )}
    </section>
  );
}

function ChecksCell({ s, caseCode }: { s: CheckSummary | null; caseCode: string }) {
  if (!s || s.documents === 0) return <span className="text-stone" title="No documents yet">–</span>;
  if (!s.toFix && !s.worthALook) return <StatusIcon kind="agree" />;
  return (
    <Link href={`/cases/${caseCode}/checks`} className="flex flex-wrap items-center gap-3">
      <StatusCount kind="mismatch" n={s.toFix} />
      <StatusCount kind="warning" n={s.worthALook} />
      {s.forYou ? (
        <span className="inline-flex items-center gap-1 text-caption font-semibold text-charcoal" title={`${s.forYou} you can fix`}>
          <Wrench size={14} strokeWidth={1.8} aria-label="Yours to fix" role="img" />
          {s.forYou}
        </span>
      ) : null}
    </Link>
  );
}

function CaseTable({ cases, progress }: { cases: CaseRow[]; progress: Progress }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-hairline">
        <table className="w-full min-w-[960px] text-left text-body-sm">
          <thead className="bg-surface-soft text-caption text-steel">
            <tr>
              <th className="px-5 py-3 font-semibold">Case ID</th>
              <th className="px-5 py-3 font-semibold">Progress</th>
              <th className="px-5 py-3 font-semibold">Next step</th>
              <th className="px-5 py-3 font-semibold">Checks</th>
              <th className="px-5 py-3 font-semibold">Consignee</th>
              <th className="px-5 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const p = progress[c.id];
              return (
                <tr key={c.id} className="border-t border-hairline-soft align-top transition-colors duration-150 hover:bg-surface-soft">
                  <td className="px-5 py-4">
                    <Link href={`/cases/${c.caseCode}`} className="block font-mono font-medium text-link-blue">{c.caseCode}</Link>
                    <p className="mt-1 flex items-center gap-1.5 text-caption text-steel">{c.exportPortCode} <ArrowRight size={12} strokeWidth={1.8} aria-label="to" role="img" /> {countryName(c.destinationCountry)}</p>
                  </td>
                  <td className="px-5 py-4">{p ? <FlowStrip steps={p.flow.steps} compact /> : null}</td>
                  <td className="max-w-[260px] px-5 py-4 text-charcoal">{p?.flow.next}</td>
                  <td className="px-5 py-4"><ChecksCell s={p?.summary ?? null} caseCode={c.caseCode} /></td>
                  <td className="px-5 py-4 text-charcoal">
                    {c.consigneeUsername ? (
                      <>
                        {c.consigneeParty} <span className="font-mono text-caption text-steel">@{c.consigneeUsername}</span>
                        {c.consigneeStatus === "pending" ? <span className="text-caption text-steel"> · invited</span> : null}
                      </>
                    ) : (
                      c.consigneeName ?? <span className="text-steel">Not invited yet</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate">{formatDate(c.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex items-start gap-2 text-caption text-steel">
        <Info size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Each case moves through: case created, people invited, documents added, checks clean, then the gate (not live yet). Your profile checks are on the Profile page.</span>
      </p>
    </div>
  );
}
