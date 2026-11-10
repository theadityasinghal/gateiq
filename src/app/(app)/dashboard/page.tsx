import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldVerification } from "@/db/schema";
import { requireOnboardedUser } from "@/server/session";
import { listCasesForOwner, listPendingInvites, listSharedCases, type CaseRow, type PendingInvite } from "@/server/cases/service";
import { respondToInvite } from "@/server/cases/members";
import { summarizeChecks, type CheckSummary } from "@/server/cases/checks";
import type { Role } from "@/lib/roles";
import { ROLE_INFO } from "@/lib/roles";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, tintBg } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { CASE_STATUS_LABEL, countryName, formatDate } from "@/lib/format";
import type { VerificationLevel } from "@/lib/verify/types";

export const metadata = { title: "Dashboard" };

const FIELD_LABEL: Record<string, string> = {
  email: "Email",
  legalName: "Legal name",
  organisation: "Organisation",
  phone: "Mobile",
  gstin: "GSTIN",
  iec: "IEC",
  address: "Address",
  chaLicence: "CHA licence",
  transporterGstin: "Transporter GSTIN",
  drivingLicence: "Driving licence",
  employeeId: "Employee ID",
};

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const info = ROLE_INFO[user.role];
  const [checks, invites] = await Promise.all([
    db.select().from(fieldVerification).where(eq(fieldVerification.userId, user.id)),
    listPendingInvites(user.id),
  ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-micro-upper text-steel">{info.label}</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">
            {user.role === "consignor" ? "Your cases" : `Welcome, ${user.name.split(" ")[0]}`}
          </h1>
        </div>
        {user.role === "consignor" ? <ButtonLink href="/cases/new">New case</ButtonLink> : null}
      </div>

      {invites.length ? <Invitations invites={invites} /> : null}

      {user.role === "consignor" ? <OwnCases viewer={{ id: user.id, role: user.role }} /> : <SharedCases viewer={{ id: user.id, role: user.role }} tint={tintBg[info.tint]} />}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-h5">Profile checks</h2>
          <Link href="/profile" className="text-[14px] font-medium text-link-blue">Edit profile</Link>
        </div>
        <ul className="divide-y divide-hairline-soft">
          {checks.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-charcoal">{FIELD_LABEL[c.field] ?? c.field}</p>
                <p className="truncate text-caption text-steel">{String((c.evidence as { message?: string }).message ?? "")}</p>
              </div>
              <VerificationBadge level={c.level as VerificationLevel} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Invitations({ invites }: { invites: PendingInvite[] }) {
  return (
    <section aria-labelledby="invites-heading" className="rounded-lg border border-hairline bg-canvas p-6">
      <div className="mb-4 flex items-center gap-2">
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
                {i.inviterRole ? ` (${ROLE_INFO[i.inviterRole].label})` : ""} invited you · {i.exportPortCode} → {countryName(i.destinationCountry)} ·{" "}
                {formatDate(i.createdAt)}
              </p>
            </div>
            <form action={respondToInvite} className="flex gap-2">
              <input type="hidden" name="memberId" value={i.id} />
              <Button type="submit" name="decision" value="decline" variant="secondary">Decline</Button>
              <Button type="submit" name="decision" value="accept">Accept</Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Viewer = { id: string; role: Role };

async function withChecks(cases: CaseRow[], viewer: Viewer) {
  const sums = await Promise.all(cases.map((c) => summarizeChecks(c.caseCode, viewer)));
  return Object.fromEntries(cases.map((c, i) => [c.id, sums[i]]));
}

async function OwnCases({ viewer }: { viewer: Viewer }) {
  const cases = await listCasesForOwner(viewer.id);
  if (!cases.length) {
    return (
      <div className="rounded-lg bg-surface p-10 text-center">
        <h2 className="text-h4">No cases yet</h2>
        <p className="mx-auto mt-2 max-w-[480px] text-slate">
          Create a case for each consignment. You&apos;ll get a Case ID, and you can invite your consignee, CHA and transporter to it.
        </p>
        <ButtonLink href="/cases/new" className="mt-6">Create your first case</ButtonLink>
      </div>
    );
  }
  return <CaseTable cases={cases} checks={await withChecks(cases, viewer)} />;
}

async function SharedCases({ viewer, tint }: { viewer: Viewer; tint: string }) {
  const cases = await listSharedCases(viewer.id);
  const checks = await withChecks(cases, viewer);
  return (
    <section className="space-y-4">
      <h2 className="text-h4">Cases shared with you</h2>
      {cases.length ? (
        <CaseTable cases={cases} checks={checks} />
      ) : (
        <div className={`${tint} rounded-lg p-8 text-charcoal`}>
          <p className="max-w-[640px] text-body-sm">
            When someone invites you to a case, the invite shows up here. Once you accept, you can view the case. Give them your username so they can find you.
          </p>
        </div>
      )}
    </section>
  );
}

function ChecksCell({ s, caseCode }: { s: CheckSummary | null; caseCode: string }) {
  if (!s || s.documents === 0) return <span className="text-steel">No documents yet</span>;
  if (!s.toFix && !s.worthALook) return <Tag tone="green">No open issues</Tag>;
  return (
    <Link href={`/cases/${caseCode}?tab=checks`} className="flex flex-wrap items-center gap-1.5">
      {s.toFix ? <Tag tone="red">{s.toFix} to fix</Tag> : null}
      {s.worthALook ? <Tag tone="orange">{s.worthALook} to look at</Tag> : null}
      {s.forYou ? <span className="text-caption font-medium text-charcoal">{s.forYou} for you</span> : null}
    </Link>
  );
}

function CaseTable({ cases, checks }: { cases: CaseRow[]; checks: Record<string, CheckSummary | null> }) {
  return (
    <div className="overflow-x-auto rounded-md border border-hairline">
      <table className="w-full min-w-[760px] text-left text-body-sm">
        <thead className="bg-surface-soft text-caption text-steel">
          <tr>
            <th className="px-5 py-3 font-semibold">Case ID</th>
            <th className="px-5 py-3 font-semibold">Consignee</th>
            <th className="px-5 py-3 font-semibold">Route</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Checks</th>
            <th className="px-5 py-3 font-semibold">Created</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="border-t border-hairline-soft">
              <td className="px-5 py-4">
                <Link href={`/cases/${c.caseCode}`} className="font-mono font-medium text-link-blue">{c.caseCode}</Link>
              </td>
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
              <td className="px-5 py-4 text-slate">{c.exportPortCode} → {countryName(c.destinationCountry)}</td>
              <td className="px-5 py-4">
                <Tag tone={c.status === "filed_baseline_ready" ? "green" : "orange"}>{CASE_STATUS_LABEL[c.status]}</Tag>
              </td>
              <td className="px-5 py-4"><ChecksCell s={checks[c.id] ?? null} caseCode={c.caseCode} /></td>
              <td className="px-5 py-4 text-slate">{formatDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
