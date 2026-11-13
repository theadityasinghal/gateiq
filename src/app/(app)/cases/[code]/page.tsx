import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/session";
import { loadCasePage } from "@/server/cases/page-data";
import type { CaseConsignee, CaseForUser } from "@/server/cases/service";
import { countryName } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { FlowStrip } from "@/components/flow-strip";
import { ArrowRight, Package, Route, TriangleExclamationPoint } from "lucide-react";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ tab?: string; upload?: string }> };

/** Where the old `?tab=` links of the one-page case now live. */
const LEGACY_TAB: Record<string, string> = { documents: "documents", filing: "documents", checks: "checks" };

/** The case's home: where it is in its flow, then the product it carries. */
export default async function CaseOverviewPage({ params, searchParams }: Props) {
  const [{ code }, { tab, upload }] = await Promise.all([params, searchParams]);
  const user = await requireOnboardedUser();
  const data = await loadCasePage(code, user.id, user.role);
  if (!data) notFound();
  const { c, consignee, flow } = data;
  if (tab && LEGACY_TAB[tab]) redirect(`/cases/${c.caseCode}/${LEGACY_TAB[tab]}`);
  if (c.caseCode !== code) redirect(`/cases/${c.caseCode}`);

  return (
    <div className="animate-rise space-y-6">
      {upload === "failed" ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-tag-red-bg p-4 text-body-sm text-tag-red-fg">
          <TriangleExclamationPoint size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>The case was created, but a document failed to upload. Check the storage settings and try again.</span>
        </p>
      ) : null}

      <Card>
        <h2 className="mb-4 text-h5">Tracking</h2>
        <FlowStrip steps={flow.steps} />
        <p className="mt-4 flex items-start gap-2 text-body-sm text-charcoal">
          <ArrowRight size={16} strokeWidth={1.8} className="mt-0.5 shrink-0 text-steel" aria-hidden="true" />
          <span><span className="font-medium">Next for you:</span> {flow.next}</span>
        </p>
        {flow.missing.length ? (
          <p className="mt-1 pl-6 text-caption text-steel">Still expected: {flow.missing.map((n) => n.label.toLowerCase()).join(", ")}.</p>
        ) : null}
      </Card>

      <ProductInfo c={c} consignee={consignee} />
    </div>
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
        <p className="mt-4 text-caption text-steel">Typed in when the case was created. Invite the consignee by username (People &amp; invites) to link their account.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h2 className="mb-2 text-h5">Consignee</h2>
      <p className="text-body-sm text-slate">
        {c.access === "owner"
          ? "Not invited yet. Invite your consignee by username under People & invites."
          : "The consignor hasn't invited the consignee yet."}
      </p>
    </Card>
  );
}

function ProductInfo({ c, consignee }: { c: CaseForUser; consignee: CaseConsignee | null }) {
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
