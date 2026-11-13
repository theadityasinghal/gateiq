import type { CaseForUser, Submission } from "@/server/cases/service";
import { removeSubmission } from "@/server/cases/submissions";
import { DOC_TYPES, DOC_TYPE_KEYS, addableTypes, docTypeSlug, type DocType } from "@/lib/documents";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { formatDate, formatDateTime } from "@/lib/format";
import type { NormalizedShippingBill } from "@/lib/normalize/shipping-bill";
import type { NormalizedEwayBill } from "@/lib/normalize/eway-bill";
import type { NormalizedLorryReceipt } from "@/lib/normalize/lorry-receipt";
import type { NormalizedESeal, NormalizedForm13, NormalizedVgm } from "@/lib/normalize/port-docs";
import type { NormalizedInvoice, NormalizedPackingList } from "@/lib/normalize/commercial-docs";
import { formatContainerNo, isValidContainerNo } from "@/lib/iso6346";
import { ChevronDown, FileText, History, Keyboard, Paperclip, Pencil, Plus, Route, ScanText, Trash, UserX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusCount, iconButtonClass } from "@/components/ui/status";
import { Tag } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { DocIcon } from "@/components/doc-icon";

/**
 * Everything everyone has added to the case, grouped by document type. Several of one type can sit side
 * by side (from different people, or corrected copies); none is treated as the right one.
 */
export function DocumentsTab({
  c,
  submissions,
  viewer,
  issues,
}: {
  c: CaseForUser;
  submissions: Submission[];
  viewer: { id: string; role: Role };
  /** Open check issues per submission id. */
  issues: Record<string, number>;
}) {
  const addable = addableTypes(viewer.role);
  const byType = new Map<DocType, Submission[]>();
  for (const s of submissions) byType.set(s.type, [...(byType.get(s.type) ?? []), s]);
  const shown = DOC_TYPE_KEYS.filter((t) => byType.has(t));

  return (
    <div className="animate-rise space-y-8">
      {addable.length ? (
        <details className="group relative inline-block">
          <summary className={buttonClass("primary", "list-none cursor-pointer")}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add document
            <ChevronDown size={16} strokeWidth={2} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="absolute z-10 mt-2 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-lg border border-hairline bg-canvas py-1 shadow-lg" aria-label="Add a document">
            {addable.map((t) => (
              <li key={t}>
                <a href={`/cases/${c.caseCode}/documents/new/${docTypeSlug(t)}`} title={DOC_TYPES[t].blurb} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-charcoal hover:bg-surface">
                  <DocIcon type={t} size={18} className="shrink-0 text-steel" />
                  {DOC_TYPES[t].label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {shown.length ? (
        shown.map((t) => {
          const list = byType.get(t)!;
          return (
            <section key={t} className="space-y-3">
              <h2 className="flex items-center gap-2 text-h5">
                <DocIcon type={t} size={20} className="text-steel" />
                {DOC_TYPES[t].label}
                {list.length > 1 ? <span className="text-body-sm font-normal text-stone" title="Copies from different people are compared with each other">×{list.length}</span> : null}
              </h2>
              {list.map((s) => <SubmissionCard key={s.id} c={c} s={s} viewerId={viewer.id} issues={issues[s.id] ?? 0} />)}
            </section>
          );
        })
      ) : (
        <p className="rounded-lg bg-surface p-6 text-body-sm text-slate">No documents yet.</p>
      )}
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

function SubmissionCard({ c, s, viewerId, issues }: { c: CaseForUser; s: Submission; viewerId: string; issues: number }) {
  const mine = s.addedBy === viewerId;
  const correctable = mine && s.normalized != null && DOC_TYPES[s.type].form === "structured";
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="purple">{DOC_TYPES[s.type].short}</Tag>
            {s.documentNumber ? <span className="font-mono text-[15px] font-medium text-charcoal">{s.documentNumber}</span> : null}
            {s.documentDate ? <span className="text-body-sm text-slate">{formatDate(s.documentDate)}</span> : null}
            <SourceIcon source={s.source} />
            {s.supersedesId ? (
              <span title="Corrected: replaces an earlier version" className="text-steel">
                <History size={16} strokeWidth={1.8} aria-label="Corrected" role="img" />
              </span>
            ) : null}
            {issues ? (
              <a href={`/cases/${c.caseCode}/checks`} title="Open issues involving this document" className="rounded-sm px-1 hover:bg-surface">
                <StatusCount kind="mismatch" n={issues} />
              </a>
            ) : null}
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-caption text-steel">
            <span className="text-charcoal">{mine ? "You" : s.adderName}</span>
            <span>· {ROLE_INFO[s.addedByRole].label}</span>
            <span>· {formatDateTime(s.createdAt)}</span>
            {s.adderOnCase ? null : (
              <span title="No longer on this case">
                <UserX size={14} strokeWidth={1.8} aria-label="No longer on this case" role="img" />
              </span>
            )}
          </p>
        </div>
        {mine ? (
          <div className="flex items-center">
            {correctable ? (
              <a href={`/cases/${c.caseCode}/documents/new/${docTypeSlug(s.type)}?correct=${s.id}`} className={iconButtonClass()} title="Correct" aria-label="Correct">
                <Pencil size={17} strokeWidth={1.8} aria-hidden="true" />
              </a>
            ) : null}
            <form action={removeSubmission}>
              <input type="hidden" name="submissionId" value={s.id} />
              <button type="submit" className={iconButtonClass("danger")} title="Remove" aria-label="Remove">
                <Trash size={17} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {s.normalized ? <div className="mt-5"><StructuredDetails s={s} /></div> : null}

      {s.files.length ? (
        <ul className="mt-5 space-y-2 border-t border-hairline-soft pt-4">
          {s.files.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 text-body-sm">
              <Paperclip size={15} strokeWidth={1.8} className="text-steel" aria-hidden="true" />
              <a href={`/cases/${c.caseCode}/documents/${d.id}`} target="_blank" rel="noreferrer" className="font-medium text-link-blue" title={`SHA-256 ${d.sha256}`}>
                {d.fileName}
              </a>
              <span className="text-caption text-stone">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
            </li>
          ))}
        </ul>
      ) : null}

      {s.provenance && Object.keys(s.provenance).length ? (
        <details className="mt-4 text-body-sm">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-caption text-steel" title="Where each field came from">
            <Route size={14} strokeWidth={1.8} aria-hidden="true" />
            Field sources
          </summary>
          <dl className="mt-2 grid gap-x-6 gap-y-1 rounded-lg bg-surface p-4 sm:grid-cols-2">
            {Object.entries(s.provenance).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="font-mono text-caption text-slate">{k}</dt>
                <dd className="text-caption text-steel">← {v}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </Card>
  );
}

/** How the fields got here. Everything a person adds is self-declared; the icon says how it was entered. */
function SourceIcon({ source }: { source: string }) {
  const [Icon, label] =
    source === "extracted"
      ? [ScanText, "Read from the file and confirmed · self-declared"]
      : source === "upload"
        ? [FileText, "File only · self-declared"]
        : [Keyboard, "Typed in · self-declared"];
  return (
    <span title={label} className="text-steel">
      <Icon size={16} strokeWidth={1.8} aria-label={label} role="img" />
    </span>
  );
}

function LinesTable({ heads, rows }: { heads: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-hairline">
      <table className="w-full min-w-[560px] text-left text-body-sm">
        <thead className="bg-surface-soft text-caption text-steel">
          <tr>{heads.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-hairline-soft">
              {r.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EWB_DOC: Record<string, string> = { INV: "Tax invoice", BIL: "Bill of supply", CHL: "Delivery challan", OTH: "Others" };

function StructuredDetails({ s }: { s: Submission }) {
  if (s.type === "shipping_bill") {
    const n = s.normalized as NormalizedShippingBill;
    return (
      <>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Detail label="Port"><span className="font-mono">{n.portCode}</span></Detail>
          <Detail label="Exporter IEC · GSTIN"><span className="font-mono">{n.exporter.iec} · {n.exporter.gstin ?? "—"}</span></Detail>
          <Detail label="Consignee">{n.consigneeName}</Detail>
          <Detail label="Packages">{n.totals.packages}</Detail>
          <Detail label="Gross / net weight">{n.totals.grossWeightT.toFixed(3)} t / {n.totals.netWeightT.toFixed(3)} t</Detail>
          <Detail label="FOB value">{n.totals.value.toFixed(2)} {n.currency}</Detail>
        </dl>
        <LinesTable
          heads={["#", "Description", "HS code", "Quantity", `FOB (${n.currency})`]}
          rows={n.lines.map((l) => [l.lineNo, l.description, <span key="hs" className="font-mono">{l.hsCode}</span>, `${l.quantity} ${l.uqc}`, l.value.toFixed(2)])}
        />
        {n.containers?.length ? (
          <LinesTable
            heads={["Container", "Size/type", "Seal"]}
            rows={n.containers.map((k) => [<ContainerNo key="c" n={k.number} />, k.sizeType ?? "—", <span key="s" className="font-mono">{k.sealNo ?? "—"}</span>])}
          />
        ) : null}
      </>
    );
  }
  if (s.type === "eway_bill") {
    const n = s.normalized as NormalizedEwayBill;
    const today = new Date().toISOString().slice(0, 10);
    const expired = n.validUntil != null && n.validUntil < today;
    return (
      <>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Detail label="Valid until">{n.validUntil ? formatDate(n.validUntil) : "Not given"} {expired ? <Tag tone="red">Expired</Tag> : null}</Detail>
          <Detail label={EWB_DOC[n.invoice.type] ?? n.invoice.type}><span className="font-mono">{n.invoice.number}</span> · {formatDate(n.invoice.date)}</Detail>
          <Detail label="Taxable value">{n.totals.value.toFixed(2)} INR</Detail>
          <Detail label="From GSTIN · PIN"><span className="font-mono">{n.from.gstin} · {n.from.pincode}</span></Detail>
          <Detail label="To GSTIN · PIN"><span className="font-mono">{n.to.gstin} · {n.to.pincode}</span></Detail>
          <Detail label="Mode · distance">{n.transport.mode} · {n.transport.distanceKm} km</Detail>
          <Detail label="Vehicle (Part B)"><span className="font-mono">{n.transport.vehicleNumber ?? "Not assigned"}</span></Detail>
          <Detail label="Transporter ID"><span className="font-mono">{n.transport.transporterId ?? "Not given"}</span></Detail>
        </dl>
        <LinesTable
          heads={["#", "Product", "HSN", "Quantity", "Taxable (INR)"]}
          rows={n.lines.map((l) => [l.lineNo, l.description, <span key="hs" className="font-mono">{l.hsCode}</span>, `${l.quantity} ${l.uqc}`, l.value.toFixed(2)])}
        />
      </>
    );
  }
  if (s.type === "lorry_receipt") {
    const n = s.normalized as NormalizedLorryReceipt;
    return (
      <dl className="grid gap-4 sm:grid-cols-3">
        <Detail label="Vehicle"><span className="font-mono">{n.vehicleNumber}</span></Detail>
        <Detail label="Route">{n.route.from} → {n.route.to}</Detail>
        <Detail label="Driver">{n.driver.name ?? "Not given"}{n.driver.phone ? <span className="font-mono text-steel"> · {n.driver.phone}</span> : null}</Detail>
        <Detail label="Goods">{n.goodsDescription}</Detail>
        <Detail label="Packages">{n.packages}</Detail>
        <Detail label="Charged weight">{n.chargedWeightT.toFixed(3)} t</Detail>
        {n.containerNumbers?.length ? <Detail label="Containers"><Containers list={n.containerNumbers} /></Detail> : null}
      </dl>
    );
  }
  if (s.type === "form_13") {
    const n = s.normalized as NormalizedForm13;
    return (
      <dl className="grid gap-4 sm:grid-cols-3">
        <Detail label="Container"><ContainerNo n={n.container.number} />{n.container.isoCode ? <span className="text-steel"> · {n.container.isoCode}</span> : null}</Detail>
        <Detail label="Line seal · e-seal"><span className="font-mono">{n.container.lineSeal ?? "—"} · {n.container.eSeal ?? "—"}</span></Detail>
        <Detail label="VGM">{n.vgmT.toFixed(3)} t</Detail>
        <Detail label="Shipping bill">{n.sbNumber ? <span className="font-mono">{n.sbNumber}</span> : "Not given"}</Detail>
        <Detail label="Shipper">{n.shipperName ?? "Not given"}</Detail>
        <Detail label="Port of discharge · vessel"><span className="font-mono">{n.pod ?? "—"} · {n.vesselCall ?? "—"}</span></Detail>
        {n.vehicleNumber ? <Detail label="Vehicle"><span className="font-mono">{n.vehicleNumber}</span></Detail> : null}
      </dl>
    );
  }
  if (s.type === "vgm_declaration") {
    const n = s.normalized as NormalizedVgm;
    return (
      <>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Detail label="Booking"><span className="font-mono">{n.bookingNo}</span></Detail>
          <Detail label="Shipper">{n.shipperName}{n.shipperIec ? <span className="font-mono text-steel"> · {n.shipperIec}</span> : null}</Detail>
          <Detail label="Method · weighbridge">Method {n.method}{n.weighbridgeRegNo ? <span className="font-mono text-steel"> · {n.weighbridgeRegNo}</span> : null}</Detail>
        </dl>
        <LinesTable
          heads={["Container", "VGM", "Tare"]}
          rows={n.containers.map((k) => [<ContainerNo key="c" n={k.number} />, `${k.vgmT.toFixed(3)} t`, k.tareT != null ? `${k.tareT.toFixed(3)} t` : "Not given"])}
        />
      </>
    );
  }
  if (s.type === "e_seal") {
    const n = s.normalized as NormalizedESeal;
    return (
      <dl className="grid gap-4 sm:grid-cols-3">
        <Detail label="Container"><ContainerNo n={n.containerNumber} /></Detail>
        <Detail label="Shipping bill"><span className="font-mono">{n.sbNumber}</span> · {formatDate(n.sbDate)}</Detail>
        <Detail label="IEC"><span className="font-mono">{n.iec}</span></Detail>
        <Detail label="Truck"><span className="font-mono">{n.truckNumber ?? "Not given"}</span></Detail>
      </dl>
    );
  }
  if (s.type === "commercial_invoice") {
    const n = s.normalized as NormalizedInvoice;
    return (
      <>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Detail label="Exporter GSTIN"><span className="font-mono">{n.exporterGstin ?? "Not given"}</span></Detail>
          <Detail label="Buyer">{n.buyerName}{n.destinationCountry ? <span className="text-steel"> · {n.destinationCountry}</span> : null}</Detail>
          <Detail label="Total">{n.totals.value.toFixed(2)} {n.currency}</Detail>
          {n.irn ? <Detail label="IRN"><span className="break-all font-mono text-caption">{n.irn}</span></Detail> : null}
        </dl>
        <LinesTable
          heads={["#", "Description", "HSN", "Quantity", `Value (${n.currency})`]}
          rows={n.lines.map((l) => [l.lineNo, l.description, <span key="hs" className="font-mono">{l.hsCode}</span>, `${l.quantity} ${l.uqc}`, l.value.toFixed(2)])}
        />
      </>
    );
  }
  if (s.type === "packing_list") {
    const n = s.normalized as NormalizedPackingList;
    return (
      <dl className="grid gap-4 sm:grid-cols-3">
        <Detail label="Packages">{n.totals.packages}</Detail>
        <Detail label="Gross / net weight">{n.totals.grossWeightT.toFixed(3)} t / {n.totals.netWeightT != null ? `${n.totals.netWeightT.toFixed(3)} t` : "—"}</Detail>
        {n.containerNumbers.length ? <Detail label="Containers"><Containers list={n.containerNumbers} /></Detail> : null}
      </dl>
    );
  }
  return null;
}

/** A container number as painted on the door, with a warning when its check digit fails. */
function ContainerNo({ n }: { n: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="font-mono">{formatContainerNo(n)}</span>
      {isValidContainerNo(n) ? null : <Tag tone="red" title="The ISO 6346 check digit doesn't match: the number was probably mistyped">Check digit</Tag>}
    </span>
  );
}

function Containers({ list }: { list: string[] }) {
  return (
    <span className="flex flex-col gap-1">
      {list.map((n) => <ContainerNo key={n} n={n} />)}
    </span>
  );
}
