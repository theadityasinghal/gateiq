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
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

/**
 * Everything everyone has added to the case, grouped by document type. Several of one type can sit side
 * by side (from different people, or corrected copies); none is treated as the right one.
 */
export function DocumentsTab({ c, submissions, viewer }: { c: CaseForUser; submissions: Submission[]; viewer: { id: string; role: Role } }) {
  const addable = addableTypes(viewer.role);
  const byType = new Map<DocType, Submission[]>();
  for (const s of submissions) byType.set(s.type, [...(byType.get(s.type) ?? []), s]);
  const shown = DOC_TYPE_KEYS.filter((t) => byType.has(t) || addable.includes(t));
  const missing = DOC_TYPE_KEYS.filter((t) => !shown.includes(t));

  return (
    <div className="space-y-10">
      <Card>
        <h2 className="text-h5">Add a document</h2>
        {addable.length ? (
          <>
            <p className="mt-1 text-body-sm text-slate">
              As a {ROLE_INFO[viewer.role].label} you can add these. Everyone on the case sees what you add, and you can remove only your own.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {addable.map((t) => (
                <ButtonLink key={t} href={`/cases/${c.caseCode}/documents/new/${docTypeSlug(t)}`} variant="secondary">
                  + {DOC_TYPES[t].label}
                </ButtonLink>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-body-sm text-slate">A {ROLE_INFO[viewer.role].label} doesn&apos;t add documents at this stage. You can see everything the others add.</p>
        )}
      </Card>

      {shown.map((t) => {
        const list = byType.get(t) ?? [];
        return (
          <section key={t} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h4">{DOC_TYPES[t].label}</h2>
              <Tag tone="gray">{list.length}</Tag>
              {list.length > 1 ? <span className="text-caption text-steel">Several copies; the gate compares them with each other.</span> : null}
            </div>
            {list.length ? (
              list.map((s) => <SubmissionCard key={s.id} c={c} s={s} viewerId={viewer.id} />)
            ) : (
              <p className="rounded-lg bg-surface p-6 text-body-sm text-slate">Nobody has added one yet.</p>
            )}
          </section>
        );
      })}

      {missing.length ? (
        <p className="text-caption text-steel">
          Not added yet: {missing.map((t) => `${DOC_TYPES[t].label} (by ${DOC_TYPES[t].issuers.map((r) => ROLE_INFO[r].label).join(" or ")})`).join("; ")}.
        </p>
      ) : null}
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

function SubmissionCard({ c, s, viewerId }: { c: CaseForUser; s: Submission; viewerId: string }) {
  const mine = s.addedBy === viewerId;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="purple">{DOC_TYPES[s.type].short}</Tag>
            {s.documentNumber ? <span className="font-mono text-[15px] font-medium text-charcoal">{s.documentNumber}</span> : null}
            {s.documentDate ? <span className="text-body-sm text-slate">{formatDate(s.documentDate)}</span> : null}
            <Tag tone="orange" title="Entered by a person; not fetched from the government system">Self-declared</Tag>
          </div>
          <p className="text-caption text-steel">
            Added by {s.adderName} {s.adderUsername ? <span className="font-mono">@{s.adderUsername}</span> : null}
            {mine ? " (you)" : ""} · {ROLE_INFO[s.addedByRole].label} · {formatDateTime(s.createdAt)}
            {s.adderOnCase ? null : <span className="ml-2"><Tag tone="gray">No longer on this case</Tag></span>}
          </p>
        </div>
        {mine ? (
          <form action={removeSubmission}>
            <input type="hidden" name="submissionId" value={s.id} />
            <button type="submit" className="min-h-10 rounded-sm px-3 py-2 text-[14px] font-medium text-error active:bg-surface">Remove</button>
          </form>
        ) : null}
      </div>

      {s.normalized ? <div className="mt-5"><StructuredDetails s={s} /></div> : null}

      {s.files.length ? (
        <ul className="mt-5 space-y-2 border-t border-hairline-soft pt-4">
          {s.files.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 text-body-sm">
              <a href={`/cases/${c.caseCode}/documents/${d.id}`} target="_blank" rel="noreferrer" className="font-medium text-link-blue">{d.fileName}</a>
              <span className="text-steel">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
              <span className="font-mono text-caption text-stone" title="SHA-256 of the uploaded file">{d.sha256.slice(0, 12)}…</span>
            </li>
          ))}
        </ul>
      ) : null}

      {s.provenance && Object.keys(s.provenance).length ? (
        <details className="mt-4 rounded-lg bg-surface p-4 text-body-sm">
          <summary className="cursor-pointer font-medium text-charcoal">Where each field came from</summary>
          <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
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
          <Detail label="Consignee (normalised)">{n.consigneeName}</Detail>
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
          <Detail label="Buyer (normalised)">{n.buyerName}{n.destinationCountry ? <span className="text-steel"> · {n.destinationCountry}</span> : null}</Detail>
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
