/**
 * HTML for each mock document. Rendered to PDF or PNG by render.ts. These are deliberately plain: enough
 * layout to look like the paper a person would photograph or scan, with every field the GateIQ form asks for
 * labelled the way the form labels it. Every page carries a footer saying it is fictional.
 */
import type { Forms } from "./forms";
import { totals, type Ship } from "./shipments";

type F = Record<string, unknown>;

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const num = (v: unknown, dp = 0) => Number(v).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const dmy = (iso: unknown) => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const spaced = (no: string) => (/^[A-Z]{4}\d{7}$/.test(no) ? `${no.slice(0, 4)} ${no.slice(4, 10)} ${no.slice(10)}` : no);

const CSS = `
@page{size:A4;margin:11mm}
*{box-sizing:border-box}
body{font:11px/1.45 Helvetica,Arial,sans-serif;color:#111;margin:0;width:188mm}
h1{font-size:17px;margin:0;letter-spacing:.2px}
h2{font-size:11px;margin:14px 0 5px;text-transform:uppercase;letter-spacing:.8px;color:#444;border-bottom:1px solid #999;padding-bottom:2px}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:8px}
.top .sub{color:#444;font-size:10.5px;margin-top:2px}
.ref{text-align:right;font-size:10.5px}
.ref b{font-size:13px}
.kv{display:grid;gap:7px 14px;margin:6px 0}
.c2{grid-template-columns:1fr 1fr}.c3{grid-template-columns:1fr 1fr 1fr}.c4{grid-template-columns:1fr 1fr 1fr 1fr}
.kv span{display:block;font-size:9.5px;color:#555;text-transform:uppercase;letter-spacing:.3px}
.kv b{display:block;font-weight:600;font-size:11.5px;word-break:break-word}
.mono{font-family:Menlo,Consolas,monospace}
table{width:100%;border-collapse:collapse;margin:6px 0}
th{background:#eee;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;padding:5px 6px;border:1px solid #bbb}
td{padding:5px 6px;border:1px solid #ccc;vertical-align:top}
td.r,th.r{text-align:right}
.box{border:1px solid #999;padding:8px 10px;margin:8px 0}
.row{display:flex;gap:18px;align-items:flex-start}
.row>div{flex:1}
.qr{width:6.2cm;height:6.2cm}
.stamp{border:2px solid #444;color:#444;padding:2px 8px;font-weight:700;letter-spacing:1px;display:inline-block;transform:rotate(-3deg)}
.foot{margin-top:16px;border-top:1px solid #bbb;padding-top:5px;font-size:9px;color:#777}
.sign{margin-top:26px;display:flex;justify-content:space-between}
@media screen{body{padding:11mm;width:auto}}
.sign div{border-top:1px solid #333;width:42%;padding-top:3px;font-size:10px}
`;

type PageOpts = { title: string; subtitle?: string; ref?: Array<[string, string]>; body: string; fictionalAs: string };

function page(o: PageOpts): string {
  const ref = (o.ref ?? []).map(([k, v]) => `<div>${esc(k)} <b>${esc(v)}</b></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.title)}</title><style>${CSS}</style></head><body>
<div class="top"><div><h1>${esc(o.title)}</h1>${o.subtitle ? `<div class="sub">${o.subtitle}</div>` : ""}</div><div class="ref">${ref}</div></div>
${o.body}
<div class="foot">SAMPLE DOCUMENT. Fictional names, numbers and codes made for software testing; not a real ${esc(o.fictionalAs)}.</div>
</body></html>`;
}

const kv = (pairs: Array<[string, unknown]>, cols: 2 | 3 | 4 = 3) =>
  `<div class="kv c${cols}">${pairs.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v === null || v === "" || v === undefined ? "-" : v)}</b></div>`).join("")}</div>`;

const table = (heads: Array<string | [string, "r"]>, rows: unknown[][]) =>
  `<table><tr>${heads.map((h) => (Array.isArray(h) ? `<th class="r">${esc(h[0])}</th>` : `<th>${esc(h)}</th>`)).join("")}</tr>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td${Array.isArray(heads[i]) ? ' class="r"' : ""}>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</table>`;

type Line = { description: string; hsCode: string; quantity: number; uqc: string; value: number };

/* ───────────── Structured documents ───────────── */

export function shippingBillHtml(s: Ship, f: F): string {
  const lines = f.lines as Line[];
  const boxes = f.containers as Array<{ containerNo: string; sizeType: string; sealNo: string }>;
  return page({
    title: "SHIPPING BILL FOR EXPORT",
    subtitle: "Customs, Indian Customs EDI System (ICES) · Free / Duty Drawback",
    ref: [["S/Bill No.", String(f.sbNumber)], ["Date", dmy(f.sbDate)], ["Port Code", String(f.portCode)]],
    fictionalAs: "shipping bill",
    body: `
<h2>Exporter</h2>
${kv([["Exporter name", s.exporter.name], ["Address", s.exporter.address], ["IEC", f.exporterIec], ["GSTIN", f.exporterGstin]], 2)}
<h2>Consignee</h2>
${kv([["Consignee name", f.consigneeName], ["Address", s.consignee.address], ["Country of destination", s.consignee.countryName], ["Port of discharge", s.destPort]], 2)}
<h2>Shipment</h2>
${kv([["Port of export (code)", `${f.portCode} ${s.portName}`], ["Currency", f.currency], ["Total packages", num(f.totalPackages)], ["Gross weight (kg)", num(f.grossWeight, 3)], ["Net weight (kg)", num(f.netWeight, 3)], ["Weight unit", f.weightUnit]], 3)}
<h2>Item details</h2>
${table(["Inv. Sl", "Item description", "ITC-HS (8 digit)", ["Quantity", "r"], "UQC", ["FOB value (" + f.currency + ")", "r"]], lines.map((l, i) => [i + 1, l.description, l.hsCode, num(l.quantity, 3), l.uqc, num(l.value, 2)]))}
<h2>Container details (factory stuffed)</h2>
${table(["Sl", "Container number", "Size / type", "Seal number"], boxes.map((b, i) => [i + 1, spaced(b.containerNo), b.sizeType, b.sealNo]))}
<div class="sign"><div>Signature of exporter / CHA</div><div>Customs officer</div></div>`,
  });
}

export function invoiceHtml(s: Ship, f: F, qr: string | null): string {
  const lines = f.lines as Line[];
  const total = lines.reduce((a, l) => a + Number(l.value), 0);
  return page({
    title: "TAX INVOICE · EXPORT (LUT, zero rated)",
    subtitle: `${esc(s.exporter.name)}<br>${esc(s.exporter.address)}`,
    ref: [["Invoice No.", String(f.invoiceNumber)], ["Date", dmy(f.invoiceDate)], ["Currency", String(f.currency)]],
    fictionalAs: "invoice",
    body: `
<div class="row"><div>
${kv([["Seller GSTIN", f.exporterGstin], ["IEC", s.exporter.iec], ["Place of supply", "Other country"], ["Incoterm", `${s.incoterm} ${s.portName}`]], 2)}
<h2>Buyer</h2>
${kv([["Buyer name", f.buyerName], ["Address", s.consignee.address], ["Country of destination", s.consignee.countryName], ["Buyer GSTIN", "URP"]], 2)}
</div>${qr ? `<div style="flex:0 0 6.5cm;text-align:center;padding-top:6px"><img class="qr" src="${qr}"><div style="font-size:9px;color:#555">e-Invoice QR (IRP signed)</div></div>` : ""}</div>
${f.irn ? `<div class="box"><span style="font-size:9.5px;color:#555">IRN</span><br><span class="mono" style="font-size:10px;word-break:break-all">${esc(f.irn)}</span></div>` : ""}
<h2>Goods</h2>
${table(["Sl", "Description of goods", "HSN", ["Quantity", "r"], "Unit", ["Amount (" + f.currency + ")", "r"]], lines.map((l, i) => [i + 1, l.description, l.hsCode, num(l.quantity, 3), l.uqc, num(l.value, 2)]))}
<div style="text-align:right;font-size:13px;margin-top:6px">Total invoice value: <b>${esc(f.currency)} ${num(total, 2)}</b></div>
<div class="sign"><div>Authorised signatory</div><div>Buyer's acknowledgement</div></div>`,
  });
}

export function packingListHtml(s: Ship, f: F): string {
  const t = totals(s);
  const boxes = (f.containers as Array<{ containerNo: string }>).map((c) => c.containerNo);
  return page({
    title: "PACKING LIST",
    subtitle: `${esc(s.exporter.name)}<br>${esc(s.exporter.address)}`,
    ref: [["Against invoice", String(f.invoiceNumber)], ["Invoice date", dmy(f.invoiceDate)]],
    fictionalAs: "packing list",
    body: `
${kv([["Consignee", s.consignee.name], ["Port of loading", s.portName], ["Port of discharge", s.destPort], ["Booking number", s.booking]], 2)}
<h2>Packages</h2>
${table(["Description", "Package type", ["Packages", "r"], ["Net weight (kg)", "r"], ["Gross weight (kg)", "r"]], s.lines.map((l) => [l.description, l.packageType, num(l.packages), num(l.netKg, 3), num(l.grossKg, 3)]))}
${kv([["Total packages", num(f.totalPackages)], ["Total net weight (kg)", num(f.netWeight, 3)], ["Total gross weight (kg)", num(f.grossWeight, 3)]], 3)}
<h2>Container numbers</h2>
${table(["Sl", "Container number"], boxes.map((b, i) => [i + 1, spaced(b)]))}
<div style="font-size:10px;color:#555">Totals above as typed on the packing list: ${num(t.packages)} packages.</div>
<div class="sign"><div>Packed by</div><div>Authorised signatory</div></div>`,
  });
}

export function ewayBillHtml(s: Ship, f: F, qr: string | null): string {
  const lines = f.lines as Line[];
  const total = lines.reduce((a, l) => a + Number(l.value), 0);
  return page({
    title: "E-WAY BILL",
    subtitle: "Generated from the GST e-way bill system · Part A and Part B",
    ref: [["E-Way Bill No.", String(f.ewbNumber).replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3")], ["Generated on", dmy(f.ewbDate)], ["Valid until", dmy(f.validUntil)]],
    fictionalAs: "e-way bill",
    body: `
<div class="row"><div>
<h2>Part A</h2>
${kv([["From GSTIN", f.fromGstin], ["From PIN code", f.fromPincode], ["To GSTIN", f.toGstin], ["To PIN code", f.toPincode], ["Document type", "Tax Invoice"], ["Document number", f.docNumber], ["Document date", dmy(f.docDate)], ["Transaction type", "Regular"]], 2)}
</div>${qr ? `<div style="flex:0 0 6.5cm;text-align:center;padding-top:6px"><img class="qr" src="${qr}"><div style="font-size:9px;color:#555">E-way bill QR</div></div>` : ""}</div>
<h2>Items</h2>
${table(["Sl", "Product name", "HSN", ["Quantity", "r"], "Unit", ["Taxable value (INR)", "r"]], lines.map((l, i) => [i + 1, l.description, l.hsCode, num(l.quantity, 3), l.uqc, num(l.value, 2)]))}
<div style="text-align:right">Total taxable value: <b>INR ${num(total, 2)}</b></div>
<h2>Part B (transportation details)</h2>
${kv([["Mode", f.transportMode], ["Approximate distance (km)", f.distanceKm], ["Transporter ID", f.transporterId], ["Transporter name", s.transporter.name], ["Vehicle number", f.vehicleNumber || "Not entered (Part B pending)"]], 3)}`,
  });
}

export function lorryReceiptHtml(s: Ship, f: F): string {
  const boxes = (f.containers as Array<{ containerNo: string }>).map((c) => c.containerNo);
  return page({
    title: "LORRY RECEIPT / CONSIGNMENT NOTE",
    subtitle: `${esc(s.transporter.name)}<br>${esc(s.transporter.address)} · GSTIN ${esc(s.transporter.gstin)}`,
    ref: [["L.R. No.", String(f.lrNumber)], ["Date", dmy(f.lrDate)]],
    fictionalAs: "lorry receipt",
    body: `
${kv([["From", f.fromPlace], ["To", f.toPlace], ["Consignor", s.exporter.name], ["Consignee", s.consignee.name]], 2)}
<h2>Vehicle and driver</h2>
${kv([["Vehicle number", f.vehicleNumber], ["Driver name", f.driverName], ["Driver mobile", "+91 " + f.driverPhone]], 3)}
<h2>Goods</h2>
${table(["Description of goods", ["No. of packages", "r"], ["Charged weight (kg)", "r"]], [[f.goodsDescription, num(f.packages), num(f.chargedWeight, 0)]])}
${boxes.length ? `<h2>Containers carried</h2>${table(["Sl", "Container number"], boxes.map((b, i) => [i + 1, spaced(b)]))}` : ""}
${kv([["Invoice reference", s.invoice.no], ["E-way bill", s.ewb.no], ["Freight", "To pay"]], 3)}
<div class="sign"><div>Signature of driver</div><div>For ${esc(s.transporter.name)}</div></div>`,
  });
}

export function form13Html(s: Ship, f: F): string {
  return page({
    title: "e-FORM 13 · CONTAINER GATE-IN PERMISSION",
    subtitle: "Shipping line permission for a container to enter the terminal",
    ref: [["Booking No.", String(f.bookingNo)], ["Issued on", dmy(f.issuedOn)]],
    fictionalAs: "Form-13",
    body: `
<h2>Container</h2>
${kv([["Container number", spaced(String(f.containerNo))], ["ISO size/type code", f.isoCode], ["Line seal number", f.lineSealNo], ["E-seal number", f.eSealNo]], 4)}
<h2>Cargo and weight</h2>
${kv([["VGM (kg)", num(f.vgm, 0)], ["Weight unit", f.vgmUnit], ["Shipping bill number", f.sbNumber], ["Shipper", f.shipperName]], 4)}
<h2>Movement</h2>
${kv([["Port of discharge (UN/LOCODE)", f.pod], ["Vessel / voyage", f.vesselCall], ["Vehicle number", f.vehicleNumber], ["CHA licence no.", f.chaLicence]], 4)}
<div class="box" style="margin-top:14px"><span class="stamp">GATE-IN PERMITTED</span></div>`,
  });
}

export function vgmHtml(s: Ship, f: F): string {
  const rows = f.containers as Array<{ containerNo: string; vgmKg: number; tareKg: number | null }>;
  return page({
    title: "VERIFIED GROSS MASS (VGM) DECLARATION",
    subtitle: "SOLAS Chapter VI, Regulation 2",
    ref: [["Booking No.", String(f.bookingNo)], ["Weighing slip", String(f.weighingSlipNo)], ["Weighed on", dmy(f.weighedOn)]],
    fictionalAs: "VGM declaration",
    body: `
${kv([["Shipper", f.shipperName], ["Shipper IEC", f.shipperIec], ["Method of weighing", `Method ${f.method} (weighed after packing)`], ["Weighbridge registration", f.weighbridgeRegNo]], 2)}
<h2>Containers</h2>
${table(["Container number", ["VGM (kg)", "r"], ["Tare (kg)", "r"]], rows.map((r) => [spaced(r.containerNo), String(num(r.vgmKg, Number.isInteger(r.vgmKg) ? 0 : 2)), r.tareKg == null ? "-" : num(r.tareKg, 0)]))}
<div style="font-size:10px;color:#555">The weighed gross mass includes the container, its cargo and all packaging and dunnage.</div>
<div class="sign"><div>Authorised signatory of shipper</div><div>Date and place</div></div>`,
  });
}

export function eSealHtml(s: Ship, f: F): string {
  return page({
    title: "E-SEAL UPLOAD RECORD",
    subtitle: "RFID e-seal vendor app · container sealing confirmation",
    ref: [["E-seal no.", String(f.eSealNo)], ["Sealed on", dmy(f.sealedOn)]],
    fictionalAs: "e-seal record",
    body: `
${kv([["Container number", spaced(String(f.containerNo))], ["Shipping bill number", f.sbNumber], ["Shipping bill date", dmy(f.sbDate)], ["IEC", f.iec], ["Truck number", f.truckNumber], ["Exporter", s.exporter.name]], 3)}
<div class="box"><span class="stamp">SEAL APPLIED</span></div>`,
  });
}

/* ───────────── File-only documents ───────────── */

export function qualityCertHtml(s: Ship): string {
  const l = s.lines[0];
  return page({
    title: "CERTIFICATE OF QUALITY AND INSPECTION",
    subtitle: "Independent inspection agency (fictional)",
    ref: [["Certificate No.", "QC/26/04412"], ["Date", dmy(s.sb.date)]],
    fictionalAs: "certificate",
    body: `
${kv([["Exporter", s.exporter.name], ["Consignee", s.consignee.name], ["Commodity", l.description], ["Quantity", `${num(l.netKg)} kg net, ${num(l.packages)} ${l.packageType}`], ["Invoice", s.invoice.no], ["Container", spaced(s.boxes[0].no)]], 2)}
<h2>Analysis</h2>
${table(["Parameter", "Result", "Standard"], [["Moisture", "11.8 %", "max 12.5 %"], ["Average grain length", "8.31 mm", "min 8.0 mm"], ["Broken grains", "1.9 %", "max 3.0 %"], ["Foreign matter", "0.05 %", "max 0.1 %"], ["Live insects", "Nil", "Nil"]])}
<p>The lot above was drawn, sampled and tested and found to conform to the contract specification.</p>
<div class="sign"><div>Inspector</div><div>Authorised signatory</div></div>`,
  });
}

export function msdsHtml(s: Ship): string {
  const h = s.hazmat!;
  return page({
    title: "SAFETY DATA SHEET (MSDS)",
    subtitle: "Isopropyl alcohol, 99.9% · prepared in 16-section format",
    ref: [["Revision date", dmy(s.invoice.date)], ["Supplier", s.exporter.name]],
    fictionalAs: "safety data sheet",
    body: `
<h2>1. Identification</h2>
${kv([["Product name", "Isopropyl alcohol (propan-2-ol)"], ["CAS number", "67-63-0"], ["UN number", h.unNumber], ["Proper shipping name", "ISOPROPANOL"]], 2)}
<h2>2. Hazards</h2>
${kv([["Transport hazard class", `Class ${h.hazardClass} (flammable liquid)`], ["Packing group", "II"], ["Signal word", "DANGER"], ["Hazard statements", "H225 highly flammable liquid and vapour; H319 causes serious eye irritation; H336 may cause drowsiness"]], 2)}
<h2>4-6. First aid, fire-fighting, spills</h2>
<p>Eyes: rinse with water for 15 minutes. Inhalation: move to fresh air. Extinguish with alcohol-resistant foam, dry chemical or CO2. Keep away from heat and ignition sources; ground containers when transferring.</p>
<h2>7. Handling and storage</h2>
<p>Store in tightly closed steel drums, cool, ventilated place away from oxidisers. Maximum storage temperature 40 °C.</p>
<h2>14. Transport information</h2>
${kv([["UN number", h.unNumber], ["Class", h.hazardClass], ["Packing group", "II"], ["EmS", "F-E, S-D"], ["Packages", "200 litre steel drums"], ["Marine pollutant", "No"]], 3)}
<div class="sign"><div>Prepared by (HSE officer)</div><div>${esc(s.exporter.name)}</div></div>`,
  });
}

export function allHtml(s: Ship, f: Forms, qr: { invoice: string | null; eway: string | null }) {
  return {
    shippingBill: shippingBillHtml(s, f.shippingBill),
    invoice: invoiceHtml(s, f.invoice, qr.invoice),
    packingList: packingListHtml(s, f.packingList),
    ewayBill: ewayBillHtml(s, f.ewayBill, qr.eway),
    lorryReceipt: lorryReceiptHtml(s, f.lorryReceipt),
    form13: f.form13.map((x) => form13Html(s, x)),
    vgm: vgmHtml(s, f.vgm),
    eSeal: f.eSeal.map((x) => eSealHtml(s, x)),
  };
}
