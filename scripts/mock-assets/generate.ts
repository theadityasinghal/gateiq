/**
 * Builds the mock documents used to test GateIQ by hand: `npm run mocks:generate`.
 * Output goes to mock_assets/ (git-ignored). Everything is fictional. The forms behind each document are
 * parsed with the app's own schemas, run through its normalisers and its checks engine, and the expected
 * Checks-tab result printed in mock_assets/README.md is what that engine actually returns, not a guess.
 */
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  caseSchema,
  eSealSchema,
  ewayBillSchema,
  form13Schema,
  invoiceSchema,
  lorryReceiptSchema,
  packingListSchema,
  shippingBillSchema,
  vgmSchema,
} from "@/lib/case-schema";
import { runChecks } from "@/lib/checks/engine";
import type { CheckReport, CheckResult } from "@/lib/checks/types";
import { DOC_TYPES, canAddDocument, type DocType } from "@/lib/documents";
import { isValidContainerNo } from "@/lib/iso6346";
import { normalizeESeal, normalizeForm13, normalizeVgm } from "@/lib/normalize/port-docs";
import { normalizeEwayBill } from "@/lib/normalize/eway-bill";
import { normalizeInvoice, normalizePackingList } from "@/lib/normalize/commercial-docs";
import { normalizeLorryReceipt } from "@/lib/normalize/lorry-receipt";
import { normalizeShippingBill } from "@/lib/normalize/shipping-bill";
import { parsePhone } from "@/lib/phone";
import { parseQr } from "@/lib/qr/parse";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { verifyGstin, verifyIec } from "@/lib/verify/identifiers";
import { baseForms, plantProblems, type Forms } from "./forms";
import { A, B, C, day, totals, type Ship } from "./shipments";
import { deskPhoto, eInvoiceQrText, ewayQrText, irnFor, notADocument, oversizedPng, qrDataUrl, qrPng, toPdf, toPng } from "./render";
import * as T from "./templates";
import { formValuesText, type FvDoc, type Planted } from "./formvalues";

const OUT = join(process.cwd(), "mock_assets");
const FACTORS = { KGS: 0.001, MTS: 1 };
const MAX_UPLOAD = 3.5 * 1024 * 1024;

type Entry = {
  file: string;
  type: DocType;
  uploader: Role;
  /** What it is and the values to expect when it is read or typed. */
  what: string;
  planted?: string;
  normalized: (Record<string, unknown> & { documentNumber: string }) | null;
  /** The values typed into the app's form for this document (or number and date for a file-only one). */
  form: Record<string, unknown> | null;
  /** Form fields that a QR code on the file fills in. */
  fromQr?: string[];
};

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const n0 = (v: unknown) => Number(v).toLocaleString("en-IN");

function fail(msg: string): never {
  throw new Error(`mock-assets: ${msg}`);
}

/* ───────────── One consignment ───────────── */

async function buildScenario(s: Ship, forms: Forms, opts: { invoiceQr: boolean; ewayQr: boolean; skipESeal?: boolean; planted?: Record<string, string> }) {
  const dir = join(OUT, s.folder);
  mkdirSync(dir, { recursive: true });
  const t = totals(s);

  // The invoice's IRN, as the IRP would derive it.
  forms.invoice.irn = irnFor(s.exporter.gstin, s.invoice.no, s.invoice.date);

  // Validate every form with the app's schemas, exactly as the server does.
  const caseOut = caseSchema.parse(forms.caseForm);
  const sb = shippingBillSchema.parse(forms.shippingBill);
  const inv = invoiceSchema.parse(forms.invoice);
  const pl = packingListSchema.parse(forms.packingList);
  const ewb = ewayBillSchema.parse(forms.ewayBill);
  const lr = lorryReceiptSchema.parse(forms.lorryReceipt);
  const vgm = vgmSchema.parse(forms.vgm);
  const f13 = forms.form13.map((x) => form13Schema.parse(x));
  const seals = forms.eSeal.map((x) => eSealSchema.parse(x));
  const phone = parsePhone(lr.driverPhoneCountry, lr.driverPhone);
  if (!phone.ok) fail(`driver phone: ${phone.message}`);

  // Identifier checks the profile and documents rely on.
  for (const g of [s.exporter.gstin, s.transporter.gstin]) if (verifyGstin(g).level !== "format_valid") fail(`GSTIN ${g} is not valid`);
  if (verifyIec(s.exporter.iec, s.exporter.gstin).level !== "format_valid") fail(`IEC ${s.exporter.iec} does not match its GSTIN`);
  for (const b of s.boxes) if (!isValidContainerNo(b.no)) fail(`container ${b.no} fails ISO 6346`);

  // QR codes for the printouts that carry one.
  const invQrText = eInvoiceQrText({
    sellerGstin: s.exporter.gstin,
    docNo: s.invoice.no,
    date: s.invoice.date,
    totalInr: Math.round(t.valueUsd * s.inrPerUsd),
    hsn: s.lines[0].hsCode,
    irn: String(forms.invoice.irn),
    items: s.lines.length,
  });
  const ewbQrText = ewayQrText({ ewbNo: s.ewb.no, gstin: s.exporter.gstin, date: s.ewb.date });
  const invParsed = parseQr(invQrText);
  const ewbParsed = parseQr(ewbQrText);
  if (invParsed.kind !== "e_invoice" || invParsed.values.invoiceNumber !== s.invoice.no.toUpperCase()) fail("e-invoice QR is not read back by src/lib/qr/parse.ts");
  if (ewbParsed.kind !== "eway_bill" || ewbParsed.values.ewbNumber !== s.ewb.no) fail("e-way bill QR is not read back by src/lib/qr/parse.ts");

  const html = T.allHtml(s, forms, {
    invoice: opts.invoiceQr ? await qrDataUrl(invQrText) : null,
    eway: opts.ewayQr ? await qrDataUrl(ewbQrText) : null,
  });

  const entries: Entry[] = [];
  let n = 0;
  const add = (slug: string, type: DocType, uploader: Role, what: string, htmlText: string, normalized: Entry["normalized"], form: Record<string, unknown> | null, planted?: string) => {
    if (!canAddDocument(uploader, type)) fail(`${uploader} may not add ${type}`);
    const file = `${s.id}${++n}_${slug}.pdf`;
    toPdf(htmlText, join(dir, file));
    entries.push({ file: `${s.folder}/${file}`, type, uploader, what, planted, normalized, form });
  };
  const P = opts.planted ?? {};

  add("shipping-bill", "shipping_bill", "consignor", `SB ${sb.sbNumber} dated ${dmy(sb.sbDate)}, port ${sb.portCode}, ${n0(sb.totalPackages)} packages, gross ${n0(sb.grossWeight)} kg, ${sb.containers.length} container(s) listed`, html.shippingBill, {
    ...normalizeShippingBill(sb as never, FACTORS).normalized,
  } as never, forms.shippingBill, P.sb);
  add("commercial-invoice", "commercial_invoice", "consignor", `Invoice ${inv.invoiceNumber} dated ${dmy(inv.invoiceDate)}, buyer "${inv.buyerName}", ${inv.currency} ${n0(t.valueUsd)}${opts.invoiceQr ? ". Has a GST e-invoice QR code" : ". No QR code (tests reading by the model alone)"}`, html.invoice, { ...normalizeInvoice(inv as never).normalized } as never, forms.invoice, P.invoice);
  add("packing-list", "packing_list", "consignor", `Packing list for ${pl.invoiceNumber}, ${n0(pl.totalPackages)} packages, gross ${n0(pl.grossWeight)} kg, container ${pl.containers.map((c) => c.containerNo).join(", ")}`, html.packingList, { ...normalizePackingList(pl as never).normalized } as never, forms.packingList, P.packingList);
  add("e-way-bill", "eway_bill", "consignor", `E-way bill ${ewb.ewbNumber} generated ${dmy(ewb.ewbDate)}, valid until ${ewb.validUntil ? dmy(ewb.validUntil) : "-"}, vehicle ${ewb.vehicleNumber ?? "none (Part B empty)"}${opts.ewayQr ? ". Has an e-way bill QR code" : ". No QR code"}`, html.ewayBill, { ...normalizeEwayBill(ewb as never).normalized } as never, forms.ewayBill, P.ewayBill);
  add("lorry-receipt", "lorry_receipt", "transporter", `LR ${lr.lrNumber} dated ${dmy(lr.lrDate)}, truck ${lr.vehicleNumber}, ${n0(lr.packages)} packages, charged ${n0(lr.chargedWeight)} kg. Add it from the transporter's account`, html.lorryReceipt, {
    ...normalizeLorryReceipt({ ...lr, driverPhone: phone.e164 } as never).normalized,
  } as never, forms.lorryReceipt, P.lorryReceipt);
  f13.forEach((x, i) =>
    add(`form-13${f13.length > 1 ? `-container-${i + 1}` : ""}`, "form_13", "consignor", `Form-13 for booking ${x.bookingNo}, container ${x.containerNo}, VGM ${n0(x.vgm)} kg, e-seal ${x.eSealNo}, truck ${x.vehicleNumber}`, html.form13[i], { ...normalizeForm13(x as never).normalized } as never, forms.form13[i], P.form13),
  );
  add("vgm-declaration", "vgm_declaration", "consignor", `VGM declaration, booking ${vgm.bookingNo}, slip ${vgm.weighingSlipNo}, ${vgm.containers.map((c) => `${c.containerNo} ${c.vgmKg} kg (tare ${c.tareKg})`).join("; ")}`, html.vgm, { ...normalizeVgm(vgm as never).normalized } as never, forms.vgm, P.vgm);
  if (!opts.skipESeal) {
    seals.forEach((x, i) =>
      add(`e-seal${seals.length > 1 ? `-container-${i + 1}` : ""}`, "e_seal", "consignor", `E-seal ${x.eSealNo} on ${x.containerNo}, shipping bill ${x.sbNumber}`, html.eSeal[i], { ...normalizeESeal(x as never).normalized } as never, forms.eSeal[i], P.eSeal),
    );
  }
  if (s.id === "A") {
    add("quality-certificate", "quality_certificate", "consignor", `File only (nothing is read from it). Optionally type number QC/26/04412 and date ${dmy(s.sb.date)}`, T.qualityCertHtml(s), null, { documentNumber: "QC/26/04412", documentDate: s.sb.date });
  }
  if (s.hazmat) {
    add("msds", "msds", "consignor", `File only. Safety data sheet for ${s.hazmat.unNumber}, class ${s.hazmat.hazardClass}. Needed because the case is marked hazardous`, T.msdsHtml(s), null, { documentNumber: "", documentDate: s.invoice.date });
  }

  for (const e of entries) {
    if (e.type === "commercial_invoice" && opts.invoiceQr) e.fromQr = ["invoiceNumber", "invoiceDate", "exporterGstin", "irn"];
    if (e.type === "eway_bill" && opts.ewayQr) e.fromQr = ["ewbNumber", "ewbDate", "fromGstin"];
  }

  const report = runChecks({
    caseRecord: {
      exportPortCode: caseOut.exportPortCode,
      consigneeName: s.consignee.name,
      lines: caseOut.lines.map((l) => ({ hsCode: l.hsCode, packages: l.packages, grossWeight: l.grossWeight, weightUnit: l.weightUnit })),
    },
    caseOwner: { role: "consignor", name: s.exporter.name },
    submissions: entries
      .filter((e) => e.normalized)
      .map((e, i) => ({ id: `${s.id}-${i}`, type: e.type, addedByRole: e.uploader, adderName: ROLE_INFO[e.uploader].label, documentNumber: e.normalized!.documentNumber, normalized: e.normalized })),
    today: day(0),
  });
  return { entries, report, forms, caseOut };
}

/* ───────────── Junk and photos (scenario D) ───────────── */

type JunkEntry = { file: string; what: string; expect: string };

async function buildJunk(a: Awaited<ReturnType<typeof buildScenario>>): Promise<JunkEntry[]> {
  const dir = join(OUT, "D_junk-and-photos");
  mkdirSync(dir, { recursive: true });
  const s = A;
  const forms = a.forms;
  const html = T.allHtml(s, forms, {
    invoice: await qrDataUrl(eInvoiceQrText({ sellerGstin: s.exporter.gstin, docNo: s.invoice.no, date: s.invoice.date, totalInr: Math.round(totals(s).valueUsd * s.inrPerUsd), hsn: s.lines[0].hsCode, irn: String(forms.invoice.irn), items: 1 })),
    eway: await qrDataUrl(ewayQrText({ ewbNo: s.ewb.no, gstin: s.exporter.gstin, date: s.ewb.date })),
  });
  const out: JunkEntry[] = [];
  const pagePng = (name: string, htmlText: string, scale = 2) => {
    const p = join(dir, `.tmp-${name}.png`);
    toPng(htmlText, p, { scale });
    return p;
  };

  // D1: a file type the app does not accept.
  writeFileSync(join(dir, "D1_wrong-type.txt"), "Plain text notes. GateIQ accepts PDF, PNG and JPEG only.\n");
  out.push({ file: "D1_wrong-type.txt", what: "A text file, not an image or PDF", expect: 'Rejected: "Upload a PDF, PNG or JPEG." (If your file picker hides it, drag it onto the form.)' });

  // D2: over the 3.5 MB limit.
  const invoicePng = pagePng("invoice", html.invoice);
  let side = 1500;
  const big = join(dir, "D2_oversized-over-3.5MB.png");
  for (;;) {
    await oversizedPng(invoicePng, big, side);
    if (statSync(big).size > MAX_UPLOAD * 1.15) break;
    side += 200;
    if (side > 4000) fail("could not make an oversized file");
  }
  out.push({ file: "D2_oversized-over-3.5MB.png", what: `An invoice page over noise, ${(statSync(big).size / 1048576).toFixed(1)} MB`, expect: 'Rejected: "The file must be under 3.5 MB."' });

  // D3: blurry, rotated photo of scenario A's lorry receipt: tests reading by the model.
  await deskPhoto(pagePng("lr", html.lorryReceipt), join(dir, "D3_blurry-rotated-lorry-receipt.jpg"), { angle: 6, blur: 1.6, quality: 62 });
  out.push({
    file: "D3_blurry-rotated-lorry-receipt.jpg",
    what: "Phone photo of scenario A's lorry receipt: rotated 6°, soft focus, uneven light",
    expect: `Add as Lorry receipt (transporter). Reading should give LR ${s.lr.no}, truck ${s.lr.vehicle}, ${s.boxes[0].packages} packages, ${s.lr.chargedKg} kg. Low-confidence fields are highlighted for you to check`,
  });

  // D4: desk photo of scenario A's invoice with its QR code still readable.
  // A sharper, higher-resolution shot: a dense signed QR code needs a few pixels per module to survive rotation and JPEG.
  await deskPhoto(pagePng("invoice2", html.invoice, 3), join(dir, "D4_desk-photo-invoice-with-qr.jpg"), { angle: -3, blur: 0.7, quality: 88, width: 2400 });
  out.push({
    file: "D4_desk-photo-invoice-with-qr.jpg",
    what: "Photo of scenario A's invoice, slightly rotated, QR code intact",
    expect: `Add as Commercial invoice. The QR code is decoded in the browser first: invoice number ${s.invoice.no}, date ${dmy(s.invoice.date)}, seller GSTIN and IRN come from the QR (marked as QR); the rest from the model`,
  });

  // D5: not a document.
  await notADocument(join(dir, "D5_not-a-document.jpg"));
  out.push({ file: "D5_not-a-document.jpg", what: "A landscape picture", expect: "Reading should find nothing usable (empty or flagged fields) or report that it could not read the file. Try it as any structured type" });

  // D6 and D7: QR code only.
  await qrPng(eInvoiceQrText({ sellerGstin: s.exporter.gstin, docNo: s.invoice.no, date: s.invoice.date, totalInr: Math.round(totals(s).valueUsd * s.inrPerUsd), hsn: s.lines[0].hsCode, irn: String(forms.invoice.irn), items: 1 }), join(dir, "D6_qr-only-e-invoice.png"));
  out.push({ file: "D6_qr-only-e-invoice.png", what: "Just the e-invoice QR code of scenario A's invoice", expect: `Add as Commercial invoice. Works even without a Gemini key: fills invoice number ${s.invoice.no}, date ${dmy(s.invoice.date)}, exporter GSTIN and IRN. Buyer and lines stay empty` });
  await qrPng(ewayQrText({ ewbNo: s.ewb.no, gstin: s.exporter.gstin, date: s.ewb.date }), join(dir, "D7_qr-only-eway-bill.png"));
  out.push({ file: "D7_qr-only-eway-bill.png", what: "Just the e-way bill QR code of scenario A's e-way bill", expect: `Add as E-way bill. Fills number ${s.ewb.no}, from-GSTIN and date ${dmy(s.ewb.date)}; everything else is typed in` });

  for (const f of ["invoice", "lr", "invoice2"]) rmSync(join(dir, `.tmp-${f}.png`), { force: true });
  return out;
}

/* ───────────── README ───────────── */

const STATUS: Record<string, string> = { mismatch: "Mismatch", invalid: "Invalid", warning: "Warning" };

function describeResult(r: CheckResult): string {
  const groups = r.groups.map((g) => `${g.display} (${g.sources.map((x) => x.label).join(", ")})`).join(" vs ");
  const msg = r.status === "mismatch" && /^[a-z]+\.[a-zA-Z]+$/.test(r.fact) && !r.fact.startsWith("derived") ? "" : ` ${r.message}`;
  return `**${r.label}**: ${STATUS[r.status] ?? r.status}.${msg} ${groups}`.replace(/\s+/g, " ");
}

function expectedChecks(report: CheckReport): string[] {
  const rows: string[] = [];
  const all = [...report.containers.flatMap((c) => c.results.map((r) => ({ where: `container ${c.label}`, r }))), ...report.caseChecks.map((r) => ({ where: "consignment", r }))];
  const problems = all.filter((x) => x.r.status === "mismatch" || x.r.status === "invalid" || x.r.status === "warning");
  const agree = all.filter((x) => x.r.status === "agree").map((x) => x.r.label);
  rows.push(`Counts on the Checks tab: ${report.counts.mismatch} mismatch, ${report.counts.invalid} invalid, ${report.counts.warning} warning.`);
  rows.push("");
  if (problems.length) {
    for (const p of problems) rows.push(`- ${describeResult(p.r)} _(${p.where})_`);
  } else {
    rows.push("- No mismatches, warnings or invalid results.");
  }
  rows.push("");
  rows.push(`Agreeing (${agree.length}): ${agree.length ? [...new Set(agree)].join(", ") : "none"}.`);
  return rows;
}

function caseTable(s: Ship, f: Forms): string[] {
  const form = f.caseForm as { lines: Array<Record<string, unknown>> };
  const l = [
    "| Field | Value |",
    "|---|---|",
    `| Origin | ${s.originPlace} |`,
    `| Port of export | ${s.portCode} (${s.portName}) |`,
    `| Destination country | ${s.consignee.countryName} (${s.consignee.country}) |`,
    `| Destination port | ${s.destPort} |`,
    `| Incoterm | ${s.incoterm} |`,
    `| Currency | ${s.currency} |`,
    `| Special cargo | ${s.hazmat ? `Hazardous: ${s.hazmat.unNumber}, class ${s.hazmat.hazardClass}` : "None"} |`,
    "",
    "| Description | HS code | Quantity | Unit | Net wt | Gross wt | Weight unit | Packages | Package type | Value |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...form.lines.map((x) => `| ${x.description} | ${x.hsCode} | ${n0(x.quantity)} | ${x.uqc} | ${n0(x.netWeight)} | ${n0(x.grossWeight)} | ${x.weightUnit} | ${n0(x.packages)} | ${x.packageType} | ${n0(x.value)} |`),
  ];
  return l;
}

function scenarioSection(s: Ship, r: Awaited<ReturnType<typeof buildScenario>>, intro: string): string[] {
  const o: string[] = [];
  o.push(`## Scenario ${s.id}: ${s.title}`, "", intro, "");
  o.push("### 1. Create the case (as the consignor)", "", ...caseTable(s, r.forms), "");
  o.push(
    "### 2. People",
    "",
    `- **Consignee:** create an account with account type Consignee and **Organisation = ${s.consignee.name}**, then invite its username from the case. The Checks compare the consignee on the shipping bill and invoice with this name.`,
    "- **Transporter:** create a Transporter account and invite it. Only the transporter can add the lorry receipt.",
    `- Optional: put IEC ${s.exporter.iec} and GSTIN ${s.exporter.gstin} on the consignor's profile (they pass the format and check-digit tests; the checks do not read the profile).`,
    "",
  );
  o.push("### 3. Files", "", `Every field to type, in order: \`${s.folder}/${s.id}_FORM_VALUES.txt\`.`, "", "| File | Add as | Added by | What it holds |", "|---|---|---|---|");
  for (const e of r.entries) {
    o.push(`| \`${e.file}\` | ${DOC_TYPES[e.type].label} | ${ROLE_INFO[e.uploader].label.split(" /")[0]} | ${e.what}${e.planted ? `. **Planted:** ${e.planted}` : ""} |`);
  }
  o.push("", "### 4. Expected on the Checks tab (after adding every file)", "", ...expectedChecks(r.report), "");
  return o;
}

/* ───────────── main ───────────── */

/* ───────────── Form-values files ───────────── */

const toFv = (entries: Entry[]): FvDoc[] =>
  entries.map((e) => ({
    file: e.file,
    type: e.type,
    uploader: e.uploader,
    form: e.form,
    fromQr: e.fromQr,
    note:
      e.type === "lorry_receipt"
        ? "Sign in as the Transporter to add this one."
        : e.type === "msds"
          ? "Skip this step if you attached the MSDS in the Create case form (step 1)."
          : e.fromQr
            ? "Has a QR code: those fields are filled from it when you attach the file; check the rest."
            : undefined,
  }));

/** Where scenario B's mistakes sit in the forms, so the form-values file can mark them next to the field. */
function plantedFields(s: Ship): Planted[] {
  const no = (n: string) => `${n.slice(0, 4)} ${n.slice(4, 10)} ${n[10]}`;
  return [
    { type: "packing_list", path: "containers.0.containerNo", note: `wrong check digit; the real number is ${no(s.boxes[0].no)}` },
    { type: "e_seal", path: "sbNumber", note: `two digits swapped; every other document says ${s.sb.no}` },
    { type: "commercial_invoice", path: "buyerName", note: `written differently from the shipping bill's "${s.consignee.name}"` },
    { type: "lorry_receipt", path: "packages", note: "20 cartons short; the shipping bill and packing list say 600" },
    { type: "lorry_receipt", path: "chargedWeight", note: "rounded up for billing; gross weight on the shipping bill is 4080 kg" },
    { type: "eway_bill", path: "validUntil", note: "expired three days ago" },
    { type: "eway_bill", path: "vehicleNumber", note: "Part B never filled in, so no vehicle" },
    { type: "form_13", path: "vehicleNumber", note: `last two digits swapped; the lorry receipt says ${s.lr.vehicle}` },
    { type: "vgm_declaration", path: "containers.0.vgmKg", note: "this is tonnes written under a kilogram heading; Form-13 says 7820 kg" },
  ];
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const aForms = baseForms(A);
  const a = await buildScenario(A, aForms, { invoiceQr: true, ewayQr: true });
  if (a.report.counts.mismatch + a.report.counts.warning + a.report.counts.invalid !== 0) fail("scenario A is meant to be clean but the checks report issues");

  const bBase = baseForms(B);
  const bForms = plantProblems(B, bBase);
  const b = await buildScenario(B, bForms, {
    invoiceQr: false,
    ewayQr: false,
    planted: {
      packingList: "container number written with a wrong check digit",
      eSeal: "shipping bill number has two digits swapped (8204716 instead of 8204761)",
      invoice: 'buyer written as "Nordic Textile Imports Trading GmbH"',
      lorryReceipt: "580 packages instead of 600, charged weight rounded up to 4,500 kg",
      ewayBill: "expired three days ago, Part B (vehicle) empty",
      form13: "truck number last two digits swapped (TN39BX7721)",
      vgm: "weight shown as 7.82 under a kilogram heading (it is tonnes)",
    },
  });

  const cForms = baseForms(C);
  const c = await buildScenario(C, cForms, { invoiceQr: true, ewayQr: true, skipESeal: true });
  if (c.report.counts.mismatch + c.report.counts.warning + c.report.counts.invalid !== 0) fail("scenario C is meant to be clean but the checks report issues");

  const junk = await buildJunk(a);

  // Sizes: every deliberate file within the limit, except the oversized one.
  const all = [...a.entries, ...b.entries, ...c.entries].map((e) => e.file);
  for (const f of all) if (statSync(join(OUT, f)).size > MAX_UPLOAD) fail(`${f} is over 3.5 MB`);

  const today = day(0);

  // Form-values files, one per scenario, from the same objects that rendered the documents.
  const msds = c.entries.find((e) => e.type === "msds");
  const writeFv = (folder: string, letter: string, text: string) => writeFileSync(join(OUT, folder, `${letter}_FORM_VALUES.txt`), text);
  writeFv(A.folder, "A", formValuesText({ letter: "A", title: A.title, generated: today, ship: A, caseForm: a.forms.caseForm, docs: toFv(a.entries) }));
  const planted = plantedFields(B);
  writeFv(B.folder, "B", formValuesText({ letter: "B", title: B.title, generated: today, ship: B, caseForm: b.forms.caseForm, docs: toFv(b.entries), planted }));
  writeFv(C.folder, "C", formValuesText({ letter: "C", title: C.title, generated: today, ship: C, caseForm: c.forms.caseForm, docs: toFv(c.entries), msdsFile: msds ? msds.file.split("/").pop() : null }));
  const dFile = (prefix: string) => `D_junk-and-photos/${junk.find((j) => j.file.startsWith(prefix))!.file}`;
  const aEntry = (type: DocType) => a.entries.find((e) => e.type === type)!;
  writeFv("D_junk-and-photos", "D", formValuesText({
    letter: "D",
    title: "junk and photos (only the files that are real documents)",
    generated: today,
    ship: null,
    caseForm: null,
    intro: [
      "These four files are scenario A's own lorry receipt, invoice and e-way bill in other forms (photo, QR only),",
      "so the form values are scenario A's. Use a case made from A_clean/A_FORM_VALUES.txt (its steps 1 and 2),",
      "then add these files to it. Add them to a fresh case if A's documents are already on it, to avoid duplicates.",
    ],
    docs: [
      { file: dFile("D3"), type: "lorry_receipt", uploader: "transporter", form: aEntry("lorry_receipt").form, note: "Blurry, rotated phone photo: Gemini reads it; low-confidence fields are highlighted. Sign in as the Transporter." },
      { file: dFile("D4"), type: "commercial_invoice", uploader: "consignor", form: aEntry("commercial_invoice").form, fromQr: ["invoiceNumber", "invoiceDate", "exporterGstin", "irn"], note: "Desk photo with the e-invoice QR code intact: QR fields are filled exactly, the rest comes from the model." },
      { file: dFile("D6"), type: "commercial_invoice", uploader: "consignor", form: aEntry("commercial_invoice").form, fromQr: ["invoiceNumber", "invoiceDate", "exporterGstin", "irn"], note: "QR code only: just the marked fields are filled, with or without a Gemini key. Type the rest from the values below." },
      { file: dFile("D7"), type: "eway_bill", uploader: "consignor", form: aEntry("eway_bill").form, fromQr: ["ewbNumber", "ewbDate", "fromGstin"], note: "QR code only: just the marked fields are filled. Type the rest from the values below." },
    ],
    outro: [
      "-".repeat(78),
      "Not real documents (no form values): D1_wrong-type.txt and D2_oversized-over-3.5MB.png should be",
      "rejected on upload; D5_not-a-document.jpg should read as empty or fail to read.",
    ],
  }));

  const md: string[] = [];
  md.push(
    "# GateIQ mock documents",
    "",
    `Generated ${today} by \`npm run mocks:generate\` (see \`scripts/mock-assets/\`). This folder is git-ignored; rerun the command to rebuild it. **All names, numbers and codes are fictional.** Each page says so in its footer.`,
    "",
    "Dates are relative to the day of generation (invoice 6 days ago, shipping bill 3 days ago, and so on) so none is in the future. Scenario A's e-way bill is valid until " +
      `${dmy(A.ewb.validUntil!)} and C's until ${dmy(C.ewb.validUntil!)}; after that the Checks will flag them as expired. Rerun the generator to refresh.`,
    "",
    "## How to use",
    "",
    "1. Sign up three accounts: a **Consignor**, a **Consignee** and a **Transporter** (usernames are permanent, so pick ones you will remember).",
    "2. As the consignor, create the case with the values in the scenario's first table, then invite the consignee and transporter by username. Accept the invites from their dashboards.",
    "3. Each scenario folder has a plain-text `<LETTER>_FORM_VALUES.txt` (for example `A_clean/A_FORM_VALUES.txt`) listing every field of the Create case form and of each document's form, in the order to click through, with values exactly as printed. Keep it open next to the app and copy from it. Scenario B marks each planted mistake next to its field.",
    "4. Add each file under Documents, Add document, choosing the type named in the Files table. Use the file picker for the document, then check the pre-filled form (QR values and model readings are marked) before saving. Without a Gemini key, only QR codes are read and the rest is typed from the values shown.",
    "5. Open the Checks tab and compare with the scenario's expected result.",
    "",
    "The expected results below come from running the app's own checks engine over the same values, so they match what the Checks tab should show when every document is entered exactly as printed.",
    "",
    "| Folder | Purpose | Files |",
    "|---|---|---|",
    `| \`A_clean\` | Everything agrees | ${a.entries.length} |`,
    `| \`B_planted-problems\` | Seven deliberate mistakes | ${b.entries.length} |`,
    `| \`C_two-containers-hazmat\` | Two containers, hazardous cargo, clean | ${c.entries.length} |`,
    `| \`D_junk-and-photos\` | Rejected files, bad photos, QR-only images | ${junk.length} |`,
    "",
  );
  md.push(...scenarioSection(A, a, "One 40 ft container of basmati rice. Every document agrees, so the Checks tab should show no issues. The invoice and e-way bill carry QR codes. The lorry receipt's charged weight (24,500 kg) is 20 kg above the shipping bill's gross weight, which is inside the tolerance."));
  md.push(...scenarioSection(B, b, "One 40 ft container of cotton T-shirts with seven mistakes that really happen, each in a different document. Nothing here has a QR code, so reading depends on the model (or typing)."));
  md.push(...scenarioSection(C, c, "Two 20 ft containers of isopropyl alcohol (UN1219, class 3). The case is marked hazardous, so an MSDS is included. There are two Form-13s (one per container), one VGM declaration listing both boxes, and no e-seal records on purpose: the seals come from the shipping bill and the Form-13s."));
  md.push(
    "## Scenario D: junk and photos",
    "",
    "Use these on any case from scenario A (the photos are scenario A's own lorry receipt and invoice, so the values match A's table). Form values for the four real documents: `D_junk-and-photos/D_FORM_VALUES.txt`.",
    "",
    "| File | What it is | Expected |",
    "|---|---|---|",
    ...junk.map((j) => `| \`D_junk-and-photos/${j.file}\` | ${j.what} | ${j.expect} |`),
    "",
    "## What these files do not cover",
    "",
    "- Real ICEGATE, GST portal or shipping-line layouts: these are plausible stand-ins, so reading accuracy on real papers will differ.",
    "- The e-invoice QR signature is a placeholder (GateIQ does not verify it, and says so on screen).",
    "- HS and port codes are real format and real codes to the best of our knowledge, but they are only format-checked until the port and HS masters are imported (`data/masters/README.md`).",
    "",
  );
  writeFileSync(join(OUT, "README.md"), md.join("\n"));

  const total = a.entries.length + b.entries.length + c.entries.length + junk.length;
  console.log(`Generated ${total} files in mock_assets/ (A ${a.entries.length}, B ${b.entries.length}, C ${c.entries.length}, D ${junk.length}) plus README.md`);
  console.log(`Scenario B checks: ${JSON.stringify(b.report.counts)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
