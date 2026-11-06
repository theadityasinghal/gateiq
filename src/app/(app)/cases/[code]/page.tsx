import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireOnboardedUser } from "@/server/session";
import { getOwnedCase, getShippingBillBaseline, profileIec, type OwnedCase } from "@/server/cases/service";
import { getUnitFactors } from "@/server/masters";
import { diffDeclaredVsFiled, type DiffRow, type DiffStatus } from "@/lib/diff";
import { CASE_STATUS_LABEL, countryName, formatDate, formatDateTime } from "@/lib/format";
import { normalizeCaseCode } from "@/lib/case-id";
import { SegmentedTabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ tab?: string; upload?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return { title: normalizeCaseCode(code) };
}

type Baseline = NonNullable<Awaited<ReturnType<typeof getShippingBillBaseline>>>;

export default async function CasePage({ params, searchParams }: Props) {
  const [{ code }, { tab = "product", upload }] = await Promise.all([params, searchParams]);
  const user = await requireOnboardedUser();
  if (user.role !== "consignor") redirect("/dashboard");
  const c = await getOwnedCase(code, user.id);
  if (!c) notFound();
  if (c.caseCode !== code) redirect(`/cases/${c.caseCode}${tab ? `?tab=${tab}` : ""}`);

  const sb = await getShippingBillBaseline(c.id);
  const active = ["product", "filing", "diff"].includes(tab) ? tab : "product";
  const base = `/cases/${c.caseCode}`;

  let diff: DiffRow[] | null = null;
  if (sb) {
    const [factors, iec] = await Promise.all([getUnitFactors(), profileIec(user.id)]);
    diff = diffDeclaredVsFiled(
      {
        exporterIec: iec,
        consigneeName: c.consigneeName,
        exportPortCode: c.exportPortCode,
        currency: c.currency,
        lines: c.lines.map((l) => ({
          hsCode: l.hsCode,
          description: l.description,
          quantity: Number(l.quantity),
          uqc: l.uqc,
          netWeight: Number(l.netWeight),
          grossWeight: Number(l.grossWeight),
          weightUnit: l.weightUnit,
          packages: l.packages,
          value: Number(l.value),
        })),
      },
      sb.baseline.normalized,
      factors,
    );
  }
  const mismatches = diff?.filter((r) => r.status !== "match").length ?? 0;

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
        <div className="flex flex-col gap-2 rounded-lg bg-tint-lavender p-5 text-charcoal sm:max-w-[420px]">
          <p className="text-body-sm">
            <span className="font-semibold">Share this ID with your consignee.</span> Send it outside GateIQ, by email or along with the invoice. The ID on its own doesn&apos;t give anyone access to the case.
          </p>
          <div>
            <CopyButton value={c.caseCode} label="Copy Case ID" />
          </div>
        </div>
      </div>

      {upload === "failed" ? (
        <p role="alert" className="rounded-lg bg-tag-red-bg p-4 text-body-sm text-tag-red-fg">
          The case was created, but a document failed to upload. Check the storage settings and try again.
        </p>
      ) : null}

      <SegmentedTabs
        active={active}
        tabs={[
          { key: "product", label: "Product info", href: `${base}?tab=product` },
          { key: "filing", label: "Filing", href: `${base}?tab=filing` },
          { key: "diff", label: "Declared vs filed", href: `${base}?tab=diff`, count: diff ? mismatches : undefined },
        ]}
      />

      {active === "product" ? <ProductTab c={c} /> : null}
      {active === "filing" ? <FilingTab c={c} sb={sb} /> : null}
      {active === "diff" ? <DiffTab c={c} sb={sb} diff={diff} /> : null}
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

function ProductTab({ c }: { c: OwnedCase }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-h5">Consignee</h2>
          <dl className="space-y-3">
            <Detail label="Name">{c.consigneeName}</Detail>
            <Detail label="Address"><span className="whitespace-pre-line">{c.consigneeAddress}</span></Detail>
            <Detail label="Country">{countryName(c.consigneeCountry)}</Detail>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-4 text-h5">Route and terms</h2>
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

      {c.hazmat || c.pharma || c.perishable || c.documents.length ? (
        <Card>
          <h2 className="mb-4 text-h5">Special cargo and documents</h2>
          <div className="flex flex-wrap gap-2">
            {c.hazmat ? <Tag tone="orange">Hazardous · {c.hazmat.unNumber} · Class {c.hazmat.hazardClass}</Tag> : null}
            {c.pharma ? <Tag tone="sky">Temperature {c.pharma.minC}°C to {c.pharma.maxC}°C</Tag> : null}
            {c.perishable ? <Tag tone="green">Perishable · {c.perishable.certificateType}</Tag> : null}
          </div>
          {c.documents.length ? (
            <ul className="mt-4 space-y-2">
              {c.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 text-body-sm">
                  <a href={`/cases/${c.caseCode}/documents/${d.id}`} target="_blank" rel="noreferrer" className="font-medium text-link-blue">{d.fileName}</a>
                  <span className="text-steel">{d.kind.toUpperCase()} · {(d.sizeBytes / 1024).toFixed(0)} KB</span>
                  <span className="font-mono text-caption text-stone" title="SHA-256 of the uploaded file">{d.sha256.slice(0, 12)}…</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function FilingTab({ c, sb }: { c: OwnedCase; sb: Baseline | null }) {
  if (!sb) {
    return (
      <div className="rounded-lg bg-tint-peach p-8 text-charcoal">
        <h2 className="text-h4">Attach your shipping bill</h2>
        <p className="mt-2 max-w-[640px] text-body-sm">
          After you file the shipping bill on ICEGATE, enter its details here exactly as they appear on the filing. GateIQ stores them as the Filed baseline for this case.
        </p>
        <ButtonLink href={`/cases/${c.caseCode}/filing`} className="mt-6">Record shipping bill</ButtonLink>
      </div>
    );
  }
  const n = sb.baseline.normalized;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="orange" title="Typed by the consignor; not yet fetched from ICEGATE">Self-declared</Tag>
          <Tag tone="gray">Source: manual entry</Tag>
          <Tag tone="purple">Version {sb.baseline.version}</Tag>
          <span className="text-caption text-steel">Recorded {formatDateTime(sb.baseline.createdAt)}</span>
        </div>
        <ButtonLink href={`/cases/${c.caseCode}/filing`} variant="secondary">Revise (creates a new version)</ButtonLink>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-h5">Shipping bill</h2>
          <dl className="space-y-3">
            <Detail label="Number"><span className="font-mono">{n.documentNumber}</span></Detail>
            <Detail label="Date">{formatDate(n.documentDate)}</Detail>
            <Detail label="Port"><span className="font-mono">{n.portCode}</span></Detail>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-4 text-h5">Parties</h2>
          <dl className="space-y-3">
            <Detail label="Exporter IEC"><span className="font-mono">{n.exporter.iec}</span></Detail>
            <Detail label="Exporter GSTIN"><span className="font-mono">{n.exporter.gstin ?? "Not given"}</span></Detail>
            <Detail label="Consignee (normalised)">{n.consigneeName}</Detail>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-4 text-h5">Totals (normalised)</h2>
          <dl className="space-y-3">
            <Detail label="Packages">{n.totals.packages}</Detail>
            <Detail label="Gross / net weight">{n.totals.grossWeightT.toFixed(3)} t / {n.totals.netWeightT.toFixed(3)} t</Detail>
            <Detail label="FOB value">{n.totals.value.toFixed(2)} {n.currency}</Detail>
          </dl>
        </Card>
      </div>
      <div className="overflow-x-auto rounded-md border border-hairline">
        <table className="w-full min-w-[600px] text-left text-body-sm">
          <thead className="bg-surface-soft text-caption text-steel">
            <tr>{["#", "Description", "HS code", "Quantity", `FOB (${n.currency})`].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {n.lines.map((l) => (
              <tr key={l.lineNo} className="border-t border-hairline-soft">
                <td className="px-4 py-3 text-steel">{l.lineNo}</td>
                <td className="px-4 py-3">{l.description}</td>
                <td className="px-4 py-3 font-mono">{l.hsCode}</td>
                <td className="px-4 py-3">{l.quantity} {l.uqc}</td>
                <td className="px-4 py-3">{l.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="rounded-lg bg-surface p-5 text-body-sm">
        <summary className="cursor-pointer font-medium text-charcoal">Where each field came from</summary>
        <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {Object.entries(sb.baseline.provenance).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="font-mono text-caption text-slate">{k}</dt>
              <dd className="text-caption text-steel">← {v}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

const STATUS_TAG: Record<DiffStatus, { label: string; tone: "green" | "red" | "orange" | "gray" }> = {
  match: { label: "Match", tone: "green" },
  mismatch: { label: "Mismatch", tone: "red" },
  only_declared: { label: "Only declared", tone: "orange" },
  only_filed: { label: "Only filed", tone: "orange" },
  not_comparable: { label: "Not comparable", tone: "gray" },
};

function DiffTab({ c, sb, diff }: { c: OwnedCase; sb: Baseline | null; diff: DiffRow[] | null }) {
  if (!sb || !diff) {
    return (
      <div className="rounded-lg bg-surface p-8">
        <h2 className="text-h4">Nothing to compare yet</h2>
        <p className="mt-2 text-slate">Record the shipping bill first. Then this tab shows every place it differs from what you declared.</p>
        <ButtonLink href={`/cases/${c.caseCode}/filing`} className="mt-6">Record shipping bill</ButtonLink>
      </div>
    );
  }
  const issues = diff.filter((r) => r.status !== "match");
  return (
    <div className="space-y-6">
      <div className={`rounded-lg p-6 text-charcoal ${issues.length ? "bg-tint-rose" : "bg-tint-mint"}`}>
        <h2 className="text-h4">{issues.length ? `${issues.length} difference${issues.length > 1 ? "s" : ""} found` : "Declared and filed agree"}</h2>
        <p className="mt-1 text-body-sm">
          Comparing your case with shipping bill version {sb.baseline.version}, after converting units, dates and names. GateIQ doesn&apos;t change either side.
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border border-hairline">
        <table className="w-full min-w-[640px] text-left text-body-sm">
          <thead className="bg-surface-soft text-caption text-steel">
            <tr>{["Field", "Declared (case)", "Filed (shipping bill)", "Result"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {[...issues, ...diff.filter((r) => r.status === "match")].map((r) => (
              <tr key={r.key} className="border-t border-hairline-soft align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-charcoal">{r.label}</p>
                  {r.note ? <p className="text-caption text-steel">{r.note}</p> : null}
                </td>
                <td className="px-4 py-3 font-mono text-[13px]">{r.declared ?? "Not present"}</td>
                <td className="px-4 py-3 font-mono text-[13px]">{r.filed ?? "Not present"}</td>
                <td className="px-4 py-3"><Tag tone={STATUS_TAG[r.status].tone}>{STATUS_TAG[r.status].label}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
