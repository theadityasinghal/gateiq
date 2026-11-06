import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldVerification } from "@/db/schema";
import { requireOnboardedUser } from "@/server/session";
import { listCasesForOwner } from "@/server/cases/service";
import { ROLE_INFO } from "@/lib/roles";
import { ButtonLink } from "@/components/ui/button";
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
  const checks = await db.select().from(fieldVerification).where(eq(fieldVerification.userId, user.id));

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

      {user.role === "consignor" ? <CaseList ownerId={user.id} /> : (
        <div className={`${tintBg[info.tint]} rounded-lg p-8 text-charcoal`}>
          <h2 className="text-h4">Your workspace comes in a later stage</h2>
          <p className="mt-2 max-w-[640px] text-body-sm">
            GateIQ currently covers case creation and the filed shipping bill. Screens for {info.label.toLowerCase()}s are next.
          </p>
        </div>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-h5">Profile checks</h2>
          <Link href="/onboarding/profile" className="text-[14px] font-medium text-link-blue">Edit profile</Link>
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

async function CaseList({ ownerId }: { ownerId: string }) {
  const cases = await listCasesForOwner(ownerId);
  if (!cases.length) {
    return (
      <div className="rounded-lg bg-surface p-10 text-center">
        <h2 className="text-h4">No cases yet</h2>
        <p className="mx-auto mt-2 max-w-[480px] text-slate">
          Create a case for each consignment. You&apos;ll get a Case ID to share with your consignee.
        </p>
        <ButtonLink href="/cases/new" className="mt-6">Create your first case</ButtonLink>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-hairline">
      <table className="w-full min-w-[640px] text-left text-body-sm">
        <thead className="bg-surface-soft text-caption text-steel">
          <tr>
            <th className="px-5 py-3 font-semibold">Case ID</th>
            <th className="px-5 py-3 font-semibold">Consignee</th>
            <th className="px-5 py-3 font-semibold">Route</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Created</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="border-t border-hairline-soft">
              <td className="px-5 py-4">
                <Link href={`/cases/${c.caseCode}`} className="font-mono font-medium text-link-blue">{c.caseCode}</Link>
              </td>
              <td className="px-5 py-4 text-charcoal">{c.consigneeName}</td>
              <td className="px-5 py-4 text-slate">{c.exportPortCode} → {countryName(c.destinationCountry)}</td>
              <td className="px-5 py-4">
                <Tag tone={c.status === "filed_baseline_ready" ? "green" : "orange"}>{CASE_STATUS_LABEL[c.status]}</Tag>
              </td>
              <td className="px-5 py-4 text-slate">{formatDate(c.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
