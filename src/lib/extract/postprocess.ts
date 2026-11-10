/**
 * Turns what the vision model returned (and any QR code) into pre-filled form values plus, per field,
 * where the value came from and whether it needs a closer look. Values that fail a check of their own
 * (container check digit, GSTIN check character, vehicle format, real dates) are marked for review
 * whatever confidence the model gave.
 */
import { GSTIN_RE, VEHICLE_RE } from "@/lib/case-schema";
import { DOC_FORMS, LOW_CONFIDENCE, type FieldMeta, type FieldSpec } from "@/lib/doc-forms";
import { DOC_TYPES, type DocType } from "@/lib/documents";
import { hasContainerFormat, isValidContainerNo, normalizeContainerNo, suggestContainerNo } from "@/lib/iso6346";
import { gstinCheckChar } from "@/lib/verify/identifiers";
import { qrAppliesTo, qrDateToIso, type QrReading } from "@/lib/qr/parse";

export type Offered = {
  initial: Record<string, unknown>;
  meta: Record<string, FieldMeta>;
  /** Shown above the form, e.g. when the file doesn't look like the expected document. */
  warning: string | null;
  qrExtras: Record<string, string>;
};

const GSTIN_KEYS = new Set(["exporterGstin", "fromGstin", "toGstin", "transporterId"]);
const VEHICLE_KEYS = new Set(["vehicleNumber", "truckNumber"]);
const IEC_KEYS = new Set(["exporterIec", "iec", "shipperIec"]);

type Cell = { value: string | null; confidence: number };

function asCell(v: unknown): Cell | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { value?: unknown; confidence?: unknown };
  if (o.value == null || String(o.value).trim() === "") return null;
  const c = Number(o.confidence);
  return { value: String(o.value).trim(), confidence: Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0 };
}

/** Cleans a read value for its field and says what (if anything) is wrong with it on its own. */
export function checkValue(f: FieldSpec, raw: string, today: string): { value: string | null; problem: string | null } {
  const compact = raw.toUpperCase().replace(/[\s-]/g, "");
  switch (f.kind) {
    case "container": {
      const n = normalizeContainerNo(raw);
      if (!hasContainerFormat(n)) return { value: n, problem: "Doesn't look like a container number (4 letters, 7 digits)." };
      if (!isValidContainerNo(n)) {
        const s = suggestContainerNo(n);
        return { value: n, problem: `Check digit fails: compare with the paper${s.length ? ` (one slip away: ${s.join(", ")})` : ""}.` };
      }
      return { value: n, problem: null };
    }
    case "date": {
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : qrDateToIso(raw);
      if (!iso) return { value: null, problem: `Couldn't read the date ("${raw}").` };
      if (f.noFuture && iso > today) return { value: iso, problem: "This date is in the future." };
      return { value: iso, problem: null };
    }
    case "number":
    case "integer": {
      const n = raw.replace(/[,\s]/g, "").replace(/[^0-9.]/g, "");
      if (!n || Number.isNaN(Number(n))) return { value: null, problem: `Couldn't read a number ("${raw}").` };
      return { value: n, problem: null };
    }
    case "select": {
      const opts = typeof f.options === "string" ? null : f.options ?? [];
      const v = raw.toUpperCase();
      if (opts && !opts.some((o) => o.value === v || o.value === raw)) return { value: null, problem: `"${raw}" isn't one of the choices.` };
      return { value: opts?.find((o) => o.value === raw) ? raw : v, problem: null };
    }
  }
  if (GSTIN_KEYS.has(f.key)) {
    if (compact === "URP") return { value: compact, problem: null };
    if (!GSTIN_RE.test(compact)) return { value: compact, problem: "Doesn't look like a GSTIN (15 characters)." };
    if (gstinCheckChar(compact.slice(0, 14)) !== compact[14]) return { value: compact, problem: "The GSTIN's check character doesn't match: a character was probably misread." };
    return { value: compact, problem: null };
  }
  if (VEHICLE_KEYS.has(f.key)) {
    return VEHICLE_RE.test(compact) ? { value: compact, problem: null } : { value: compact, problem: "Doesn't look like an Indian registration number." };
  }
  if (IEC_KEYS.has(f.key)) {
    const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return v.length === 10 ? { value: v, problem: null } : { value: v, problem: "An IEC is 10 characters." };
  }
  if (f.digitsOnly) return { value: raw.replace(/[^0-9]/g, ""), problem: null };
  return { value: raw, problem: null };
}

function take(f: FieldSpec, cell: Cell | null, path: string, today: string, meta: Record<string, FieldMeta>): string | null {
  if (!cell?.value) return null;
  const { value, problem } = checkValue(f, cell.value, today);
  meta[path] = {
    source: "model",
    confidence: problem ? Math.min(cell.confidence, LOW_CONFIDENCE - 0.3) : cell.confidence,
    asWritten: cell.value,
    problem,
  };
  return value;
}

export function offerFromReading(type: DocType, output: unknown, qr: QrReading | null, today: string): Offered {
  const spec = DOC_FORMS[type];
  if (!spec) throw new Error(`No form for ${type}`);
  const initial: Record<string, unknown> = {};
  const meta: Record<string, FieldMeta> = {};
  const o = (output && typeof output === "object" ? output : {}) as { fields?: Record<string, unknown>; isExpectedType?: unknown; documentLooksLike?: unknown };
  const fields = o.fields && typeof o.fields === "object" ? o.fields : {};

  for (const s of spec.sections) {
    if (s.kind === "group") {
      for (const f of s.fields) {
        const v = take(f, asCell(fields[f.key]), f.key, today, meta);
        if (v != null) initial[f.key] = v;
      }
    } else {
      const list = Array.isArray(fields[s.key]) ? (fields[s.key] as unknown[]).slice(0, s.max) : [];
      const rows = list.map((r, i) => {
        const row: Record<string, string> = {};
        const rec = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        for (const f of s.fields) {
          const v = take(f, asCell(rec[f.key]), `${s.key}.${i}.${f.key}`, today, meta);
          if (v != null) row[f.key] = v;
        }
        return row;
      });
      const kept = rows.filter((r) => Object.keys(r).length > 0);
      if (kept.length) initial[s.key] = kept;
    }
  }

  // QR values are exact: they replace whatever was read for the same field.
  let qrExtras: Record<string, string> = {};
  if (qr && qrAppliesTo(qr, type)) {
    for (const [k, v] of Object.entries(qr.values)) {
      initial[k] = v;
      meta[k] = { source: "qr" };
    }
    qrExtras = qr.extras;
  }

  let warning: string | null = null;
  if (o.isExpectedType === false) {
    warning = `This doesn't look like a ${DOC_TYPES[type].label.toLowerCase()}${typeof o.documentLooksLike === "string" && o.documentLooksLike ? `; it looks like ${o.documentLooksLike}` : ""}. Check you picked the right file.`;
  }
  return { initial, meta, warning, qrExtras };
}

function flatten(v: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (Array.isArray(v)) v.forEach((x, i) => flatten(x, prefix ? `${prefix}.${i}` : String(i), out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) flatten(x, prefix ? `${prefix}.${k}` : k, out);
  else if (v != null && String(v).trim() !== "") out[prefix] = String(v);
  return out;
}

const loose = (v: string) => v.toUpperCase().replace(/[\s\-.,/]/g, "").replace(/^0+(?=\d)/, "");

/**
 * Which fields the adder changed before saving: `corrected` were offered and then edited or cleared,
 * `typed` weren't offered and were filled in by hand. Formatting-only differences don't count.
 */
export function changedFields(offered: Record<string, unknown>, confirmed: unknown): { corrected: string[]; typed: string[] } {
  const a = flatten(offered);
  const b = flatten(confirmed);
  const corrected = Object.keys(a).filter((k) => b[k] == null || (loose(a[k]) !== loose(b[k]) && Number(a[k]) !== Number(b[k])));
  const typed = Object.keys(b).filter((k) => a[k] == null);
  return { corrected, typed };
}
