/**
 * Plain-text "form values" files: <LETTER>_FORM_VALUES.txt, one per scenario, in the order a person clicks
 * through the app (Create case, then Add document for each file). They are generated from the same form
 * objects that render the PDFs, and the labels come from the app's own form specs (src/lib/doc-forms.ts) and
 * the Create case form's labels, so a change in either cannot leave these files out of date silently.
 */
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOC_FORMS, type FieldSpec, type FormSpec, type RepeatSpec, type StaticOption } from "@/lib/doc-forms";
import { DOC_TYPES, type DocType } from "@/lib/documents";
import { INCOTERMS_2020 } from "@/lib/incoterms";
import { listPhoneCountries } from "@/lib/phone";
import { ROLE_INFO, type Role } from "@/lib/roles";
import type { Ship } from "./shipments";

countries.registerLocale(en);

type Form = Record<string, unknown>;

export type FvDoc = {
  /** Path inside mock_assets/, e.g. "A_clean/A1_shipping-bill.pdf". */
  file: string;
  type: DocType;
  uploader: Role;
  /** The values typed into the form (keys as in DOC_FORMS), or the number/date of a file-only document. */
  form: Form | null;
  /** Field paths filled from a QR code when the file is read (e.g. "invoiceNumber"). */
  fromQr?: string[];
  /** Extra line under the document heading. */
  note?: string;
};

/** A mistake planted on purpose: the field that carries it, so it can be marked next to that field. */
export type Planted = { type: DocType; path: string; note: string };

const UQC = new Map(
  readFileSync(join(process.cwd(), "data/masters/uqc.csv"), "utf8")
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((l) => {
      const [code, description] = l.split(",");
      return [code, description] as const;
    }),
);
const currencyName = (code: string) => new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code;
const PHONE = new Map(listPhoneCountries().map((c) => [c.code, `${c.code} +${c.dial}  ${c.name}`]));

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const spaced = (no: string) => (/^[A-Z]{4}\d{7}$/.test(no) ? `${no.slice(0, 4)} ${no.slice(4, 10)} ${no.slice(10)}` : no);
const EMPTY = "(leave empty)";

/** A field's value the way it appears in its control: selects show the option label, dates as printed. */
function show(field: FieldSpec, raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return EMPTY;
  const v = String(raw);
  if (field.kind === "date") return dmy(v);
  if (field.kind === "container") return spaced(v);
  if (field.kind === "number" || field.kind === "integer") return String(Number(v));
  if (field.kind === "select") {
    if (field.options === "uqc" || field.options === "massUnits") return `${v} · ${UQC.get(v) ?? v}`;
    if (field.options === "currencies") return `${v} · ${currencyName(v)}`;
    if (field.options === "phoneCountries") return PHONE.get(v) ?? v;
    if (Array.isArray(field.options)) return (field.options as readonly StaticOption[]).find((o) => o.value === v)?.label ?? v;
  }
  return v;
}

/** "Label ...... : value" lines, labels padded to one width. */
function lines(rows: Array<[label: string, value: string, mark?: string]>, indent: number): string[] {
  const w = Math.max(...rows.map((r) => r[0].length));
  const pad = " ".repeat(indent);
  return rows.map(([l, v, mark]) => `${pad}${l.padEnd(w)} : ${v}${mark ? `   <- ${mark}` : ""}`);
}

function documentBlock(doc: FvDoc, n: number, planted: Planted[]): string[] {
  const label = DOC_TYPES[doc.type].label;
  const out: string[] = [];
  out.push("-".repeat(78));
  out.push(`STEP ${n}. ${label}`);
  out.push("-".repeat(78));
  out.push(`  Menu         : Documents tab > Add document > ${label}`);
  out.push(`  Add as       : ${ROLE_INFO[doc.uploader].label} account`);
  out.push(`  File         : ${doc.file.split("/").pop()}`);
  if (doc.note) out.push(`  Note         : ${doc.note}`);
  out.push("");

  const mark = (path: string) => {
    const p = planted.find((x) => x.type === doc.type && x.path === path);
    const qr = doc.fromQr?.includes(path) ? "from the QR code" : "";
    return [p ? `planted: ${p.note}` : "", qr].filter(Boolean).join("; ") || undefined;
  };

  const spec: FormSpec | undefined = DOC_FORMS[doc.type];
  if (!spec) {
    // File-only document: the optional details under the file picker.
    const f = doc.form ?? {};
    out.push(...lines([
      ["Document number", f.documentNumber ? String(f.documentNumber) : EMPTY],
      ["Document date", f.documentDate ? dmy(String(f.documentDate)) : EMPTY],
    ], 2));
    out.push("  (Details are optional for this document; nothing is read from the file.)", "");
    return out;
  }

  const form = doc.form ?? {};
  for (const s of spec.sections) {
    if (s.kind === "group") {
      out.push(`  ${s.title}`);
      out.push(...lines(s.fields.map((f) => {
        const base = show(f, form[f.key]);
        const dflt = f.defaultValue !== undefined && form[f.key] !== undefined && String(form[f.key]) !== f.defaultValue ? `   (the form starts on "${show(f, f.defaultValue)}"; change it)` : "";
        return [f.label, base + dflt, mark(f.key)] as [string, string, string | undefined];
      }), 4));
      out.push("");
    } else {
      const rows = (form[s.key] as Form[] | undefined) ?? [];
      out.push(`  ${s.title}${rows.length ? "" : " (none: leave the section empty)"}`);
      rows.forEach((row, i) => {
        out.push(`    ${s.itemLabel} ${i + 1}`);
        out.push(...lines((s as RepeatSpec).fields.map((f) => [f.label, show(f, row[f.key]), mark(`${s.key}.${i}.${f.key}`)] as [string, string, string | undefined]), 6));
      });
      out.push("");
    }
  }
  return out;
}

export function caseBlock(caseForm: Form, extras: { msdsFile?: string | null }): string[] {
  const out: string[] = [];
  const cf = caseForm as {
    originPlace: string; exportPortCode: string; destinationCountry: string; destinationPort: string; incoterm: string; currency: string;
    lines: Array<Record<string, unknown>>; hazmat: { unNumber: string; hazardClass: string } | null;
  };
  const term = INCOTERMS_2020.find((i) => i.code === cf.incoterm);
  out.push("-".repeat(78), "STEP 1. Create the case", "-".repeat(78));
  out.push("  Page         : Dashboard > New case  (/cases/new), signed in as a Consignor / Exporter account", "");
  out.push("  Route and terms");
  out.push(...lines([
    ["Origin (place of dispatch)", cf.originPlace],
    ["Port / ICD of export", cf.exportPortCode],
    ["Destination country", countries.getName(cf.destinationCountry, "en") ?? cf.destinationCountry],
    ["Destination port (optional)", cf.destinationPort || EMPTY],
    ["Incoterm", `${cf.incoterm} · ${term?.name ?? ""}`],
    ["Invoice currency", `${cf.currency} · ${currencyName(cf.currency)}`],
  ], 4), "");
  out.push("  Goods");
  cf.lines.forEach((l, i) => {
    out.push(`    Line ${i + 1}`);
    out.push(...lines([
      ["Description", String(l.description)],
      ["HS code (8-digit)", String(l.hsCode)],
      ["Quantity", String(Number(l.quantity))],
      ["Unit (UQC)", `${l.uqc} · ${UQC.get(String(l.uqc)) ?? ""}`],
      ["Packages", String(Number(l.packages))],
      ["Package type", String(l.packageType)],
      ["Net weight", String(Number(l.netWeight))],
      ["Gross weight", String(Number(l.grossWeight))],
      ["Weight unit", `${l.weightUnit} · ${UQC.get(String(l.weightUnit)) ?? ""}`],
      [`Value (${cf.currency})`, String(Number(l.value))],
    ], 6));
  });
  out.push("", "  Special cargo");
  if (cf.hazmat) {
    out.push("    [x] Hazardous goods");
    out.push(...lines([
      ["UN number", cf.hazmat.unNumber],
      ["Hazard class", cf.hazmat.hazardClass],
      ["MSDS (file)", extras.msdsFile ? `${extras.msdsFile} (attach here, or add it later under Documents > MSDS, step below)` : "attach the MSDS file"],
    ], 6));
  } else {
    out.push("    [ ] Hazardous goods");
  }
  out.push("    [ ] Temperature-controlled (pharma)", "    [ ] Perishable", "", "  Then press Create case. The new Case ID appears on the case page.", "");
  return out;
}

export function peopleBlock(s: Ship, n: number): string[] {
  return [
    "-".repeat(78),
    `STEP ${n}. Invite people (People on this case > invite by username)`,
    "-".repeat(78),
    `  Consignee    : an account of type "${ROLE_INFO.consignee.label}" with Organisation = ${s.consignee.name}`,
    `                 (its name is what the shipping bill and invoice consignee are compared with)`,
    `  Transporter  : an account of type "${ROLE_INFO.transporter.label}" (needed to add the lorry receipt)`,
    "  Both accept the invitation from their own dashboard before they can see the case.",
    "",
  ];
}

export function formValuesText(o: {
  letter: string;
  title: string;
  generated: string;
  ship: Ship | null;
  caseForm: Form | null;
  docs: FvDoc[];
  planted?: Planted[];
  intro?: string[];
  outro?: string[];
  msdsFile?: string | null;
}): string {
  const out: string[] = [];
  out.push(`GATEIQ MOCK FORM VALUES · SCENARIO ${o.letter}: ${o.title}`);
  out.push("=".repeat(78));
  out.push(`Generated ${o.generated} by npm run mocks:generate, from the same data that renders the files.`);
  out.push("How to read this: type each value into the field with the same label. Steps are in the order to");
  out.push("click through the app. Dates are shown as printed (day/month/year): use the date picker. Numbers are");
  out.push("plain (no thousands separators). Container numbers may be typed with or without spaces.");
  if (o.planted?.length) out.push('Lines ending "<- planted: ..." are mistakes put there on purpose; the Checks tab should catch them.');
  out.push("");
  let n = 1;
  if (o.intro) out.push(...o.intro, "");
  if (o.ship && o.caseForm) {
    out.push(...caseBlock(o.caseForm, { msdsFile: o.msdsFile ?? null }));
    n = 2;
    out.push(...peopleBlock(o.ship, n++));
  }
  for (const d of o.docs) out.push(...documentBlock(d, n++, o.planted ?? []));
  if (o.outro) out.push(...o.outro, "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
