/**
 * Normaliser: turns a shipping-bill record from any source (manual form now, ULIP later)
 * into GateIQ's standard schema, and records where each normalised field came from.
 */

export type UnitFactors = Record<string, number | null | undefined>;

/** What the consignor types from their ICEGATE shipping bill (also the shape a ULIP adapter maps into). */
export type ShippingBillInput = {
  sbNumber: string;
  sbDate: string; // YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  portCode: string;
  exporterIec: string;
  exporterGstin?: string | null;
  consigneeName: string;
  currency: string;
  totalPackages: number;
  grossWeight: number;
  netWeight: number;
  weightUnit: string; // a UQC mass unit, e.g. KGS / MTS
  lines: Array<{
    description: string;
    hsCode: string;
    quantity: number;
    uqc: string;
    value: number; // FOB, in `currency`
  }>;
  /** Container block for factory-stuffed cargo; absent on older entries. */
  containers?: Array<{ containerNo: string; sizeType?: string | null; sealNo?: string | null }>;
};

export type NormalizedShippingBill = {
  documentNumber: string;
  documentDate: string; // ISO date
  portCode: string;
  exporter: { iec: string; gstin: string | null };
  consigneeName: string;
  currency: string;
  totals: { packages: number; grossWeightT: number; netWeightT: number; value: number };
  lines: Array<{ lineNo: number; description: string; hsCode: string; quantity: number; uqc: string; value: number }>;
  /** Missing on shipping bills recorded before containers were captured; read it as []. */
  containers?: Array<{ number: string; sizeType: string | null; sealNo: string | null }>;
};

export class NormalizationError extends Error {}

export function toTonnes(amount: number, unit: string, factors: UnitFactors): number {
  const factor = factors[unit.toUpperCase()];
  if (factor == null) throw new NormalizationError(`Unit ${unit} is not a mass unit in the UQC master.`);
  return round(amount * factor, 6);
}

/** Uppercase letters and digits only: "msku 123456-5" → "MSKU1234565". For IDs printed with spacing. */
export function alnum(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Accepts ISO (YYYY-MM-DD) and Indian day-first formats (DD/MM/YYYY, DD-MM-YYYY). */
export function toIsoDate(input: string): string {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    throw new NormalizationError(`Unrecognised date: ${input}`);
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new NormalizationError(`Not a real date: ${input}`);
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * ITC-HS codes are 8 digits. Dots and spaces are tolerated, and a 7-digit code is treated
 * as one that lost its leading zero in a spreadsheet (chapters 01 to 09). Anything else is rejected
 * rather than guessed.
 */
export function normalizeHsCode(input: string): string {
  const digits = input.replace(/[\s.]/g, "");
  if (/^\d{8}$/.test(digits)) return digits;
  if (/^\d{7}$/.test(digits)) return `0${digits}`;
  throw new NormalizationError(`HS code must be 8 digits (ITC-HS): ${input}`);
}

const NAME_SUFFIXES: Array<[RegExp, string]> = [
  [/\bPRIVATE LIMITED\b/g, "PVT LTD"],
  [/\bPVT\.? LTD\.?\b/g, "PVT LTD"],
  [/\bLIMITED\b/g, "LTD"],
  [/\bCOMPANY\b/g, "CO"],
  [/\bCORPORATION\b/g, "CORP"],
  [/\bINCORPORATED\b/g, "INC"],
];

/** Case-folds, strips punctuation, collapses whitespace and standardises company suffixes. */
export function normalizePartyName(input: string): string {
  let s = input.toUpperCase().replace(/[.,'"()&]/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, rep] of NAME_SUFFIXES) s = s.replace(re, rep);
  return s.replace(/\s+/g, " ").trim();
}

export function normalizeShippingBill(
  input: ShippingBillInput,
  factors: UnitFactors,
): { normalized: NormalizedShippingBill; provenance: Record<string, string> } {
  const unit = input.weightUnit.toUpperCase();
  const factor = factors[unit];
  const provenance: Record<string, string> = {
    documentNumber: "input.sbNumber (trimmed)",
    documentDate: "input.sbDate (converted to ISO)",
    portCode: "input.portCode (uppercased)",
    "exporter.iec": "input.exporterIec (uppercased)",
    "exporter.gstin": "input.exporterGstin (uppercased)",
    consigneeName: "input.consigneeName (case-folded, suffixes standardised)",
    currency: "input.currency",
    "totals.packages": "input.totalPackages",
    "totals.grossWeightT": `input.grossWeight (${unit} × ${factor})`,
    "totals.netWeightT": `input.netWeight (${unit} × ${factor})`,
    "totals.value": "sum of input.lines[].value",
  };

  const lines = input.lines.map((line, i) => {
    provenance[`lines[${i}].hsCode`] = `input.lines[${i}].hsCode (8-digit)`;
    return {
      lineNo: i + 1,
      description: line.description.trim().replace(/\s+/g, " "),
      hsCode: normalizeHsCode(line.hsCode),
      quantity: round(line.quantity, 3),
      uqc: line.uqc.toUpperCase(),
      value: round(line.value, 2),
    };
  });

  const normalized: NormalizedShippingBill = {
    documentNumber: input.sbNumber.trim(),
    documentDate: toIsoDate(input.sbDate),
    portCode: input.portCode.trim().toUpperCase(),
    exporter: {
      iec: input.exporterIec.trim().toUpperCase(),
      gstin: input.exporterGstin ? input.exporterGstin.trim().toUpperCase() : null,
    },
    consigneeName: normalizePartyName(input.consigneeName),
    currency: input.currency.toUpperCase(),
    totals: {
      packages: input.totalPackages,
      grossWeightT: toTonnes(input.grossWeight, unit, factors),
      netWeightT: toTonnes(input.netWeight, unit, factors),
      value: round(
        lines.reduce((s, l) => s + l.value, 0),
        2,
      ),
    },
    lines,
    containers: (input.containers ?? []).map((c, i) => {
      provenance[`containers[${i}].number`] = `input.containers[${i}].containerNo (letters and digits only)`;
      return {
        number: alnum(c.containerNo),
        sizeType: c.sizeType ? alnum(c.sizeType) : null,
        sealNo: c.sealNo ? alnum(c.sealNo) : null,
      };
    }),
  };
  return { normalized, provenance };
}
