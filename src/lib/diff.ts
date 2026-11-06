import {
  normalizeHsCode,
  normalizePartyName,
  round,
  toTonnes,
  type NormalizedShippingBill,
  type UnitFactors,
} from "./normalize/shipping-bill";

/** What the consignor declared when creating the case. */
export type DeclaredCase = {
  /** The consignor's IEC from their profile, if known. */
  exporterIec?: string | null;
  consigneeName: string;
  exportPortCode: string;
  currency: string;
  lines: Array<{
    hsCode: string;
    description: string;
    quantity: number;
    uqc: string;
    netWeight: number;
    grossWeight: number;
    weightUnit: string;
    packages: number;
    value: number;
  }>;
};

export type DiffStatus = "match" | "mismatch" | "only_declared" | "only_filed" | "not_comparable";

export type DiffRow = {
  key: string;
  label: string;
  declared: string | null;
  filed: string | null;
  status: DiffStatus;
  note?: string;
};

const fmtT = (t: number) => `${t.toFixed(3)} t`;
const fmtMoney = (v: number, c: string) => `${v.toFixed(2)} ${c}`;

/**
 * Declared (case) vs Filed (baseline). GateIQ never corrects either side; it only shows
 * where they disagree. Weights compare at kilogram precision, money at paise/cent precision.
 */
export function diffDeclaredVsFiled(
  declared: DeclaredCase,
  filed: NormalizedShippingBill,
  factors: UnitFactors,
): DiffRow[] {
  const rows: DiffRow[] = [];

  const compare = (key: string, label: string, d: string | null, f: string | null, note?: string) =>
    rows.push({ key, label, declared: d, filed: f, status: d === f ? "match" : "mismatch", note });

  if (declared.exporterIec) {
    compare(
      "exporterIec",
      "Exporter IEC",
      declared.exporterIec.toUpperCase(),
      filed.exporter.iec,
      "Your profile IEC compared with the IEC on the shipping bill",
    );
  }
  compare(
    "consignee",
    "Consignee",
    normalizePartyName(declared.consigneeName),
    filed.consigneeName,
    "Names compared after case-folding and standardising suffixes",
  );
  compare("port", "Port of export", declared.exportPortCode.toUpperCase(), filed.portCode);

  const dPackages = declared.lines.reduce((s, l) => s + l.packages, 0);
  compare("packages", "Total packages", String(dPackages), String(filed.totals.packages));

  const dGross = round(
    declared.lines.reduce((s, l) => s + toTonnes(l.grossWeight, l.weightUnit, factors), 0),
    3,
  );
  const dNet = round(
    declared.lines.reduce((s, l) => s + toTonnes(l.netWeight, l.weightUnit, factors), 0),
    3,
  );
  compare("grossWeight", "Gross weight", fmtT(dGross), fmtT(round(filed.totals.grossWeightT, 3)));
  compare("netWeight", "Net weight", fmtT(dNet), fmtT(round(filed.totals.netWeightT, 3)));

  const dValue = round(
    declared.lines.reduce((s, l) => s + l.value, 0),
    2,
  );
  if (declared.currency.toUpperCase() !== filed.currency) {
    rows.push({
      key: "value",
      label: "Total value",
      declared: fmtMoney(dValue, declared.currency.toUpperCase()),
      filed: fmtMoney(filed.totals.value, filed.currency),
      status: "not_comparable",
      note: "Different currencies; GateIQ does not convert exchange rates",
    });
  } else {
    compare("value", "Total value", fmtMoney(dValue, filed.currency), fmtMoney(filed.totals.value, filed.currency));
  }

  // Per HS code: quantity (same UQC) and value.
  type Agg = { qty: Map<string, number>; value: number; description: string };
  const group = (lines: Array<{ hsCode: string; quantity: number; uqc: string; value: number; description: string }>) => {
    const m = new Map<string, Agg>();
    for (const l of lines) {
      const hs = normalizeHsCode(l.hsCode);
      const a = m.get(hs) ?? { qty: new Map(), value: 0, description: l.description };
      a.qty.set(l.uqc.toUpperCase(), (a.qty.get(l.uqc.toUpperCase()) ?? 0) + l.quantity);
      a.value += l.value;
      m.set(hs, a);
    }
    return m;
  };
  const dByHs = group(declared.lines);
  const fByHs = group(filed.lines);
  const fmtQty = (q: Map<string, number>) =>
    [...q.entries()].map(([u, n]) => `${round(n, 3)} ${u}`).join(" + ");

  for (const hs of new Set([...dByHs.keys(), ...fByHs.keys()])) {
    const d = dByHs.get(hs);
    const f = fByHs.get(hs);
    const label = `HS ${hs}`;
    if (d && !f) {
      rows.push({ key: `hs:${hs}`, label, declared: fmtQty(d.qty), filed: null, status: "only_declared", note: d.description });
    } else if (!d && f) {
      rows.push({ key: `hs:${hs}`, label, declared: null, filed: fmtQty(f.qty), status: "only_filed", note: f.description });
    } else if (d && f) {
      compare(`hs:${hs}:qty`, `${label} quantity`, fmtQty(d.qty), fmtQty(f.qty));
      if (declared.currency.toUpperCase() === filed.currency) {
        compare(
          `hs:${hs}:value`,
          `${label} value`,
          fmtMoney(round(d.value, 2), filed.currency),
          fmtMoney(round(f.value, 2), filed.currency),
        );
      }
    }
  }
  return rows;
}
