/**
 * Which papers a case needs, as a list of plain rules. Each rule says when it applies and why, and the reason is
 * shown next to the missing document, so a wrong rule is easy to spot and argue with.
 *
 * These are STARTER rules, written from general export practice, not from a regulation-by-regulation review.
 * Have someone in trade operations read them (they are listed in data/masters/doc-rules.md) before relying on them.
 * Only types are imported here, so lib/documents can use this without an import cycle.
 */
import type { DocType } from "@/lib/documents";

export type RuleCase = {
  incoterm?: string | null;
  /** HS codes of the goods lines. */
  hsCodes?: readonly string[];
  hazmat?: unknown;
  pharma?: unknown;
  perishable?: { certificateType?: string } | null | unknown;
};

export type DocRule = {
  key: string;
  label: string;
  /** Any one of these types satisfies the rule. */
  anyOf: readonly DocType[];
  /** Why the case needs it, in one sentence, or null when the rule doesn't apply. */
  why: (c: RuleCase) => string | null;
};

const chapters = (c: RuleCase) => new Set((c.hsCodes ?? []).map((h) => Number(String(h).replace(/\D/g, "").slice(0, 2))).filter((n) => n > 0));
const inChapters = (c: RuleCase, from: number, to: number, also: number[] = []) => [...chapters(c)].some((n) => (n >= from && n <= to) || also.includes(n));

/** The perishable certificate the consignor picked when creating the case, as a document type. */
const PERISHABLE_TYPE: Record<string, DocType> = {
  "Phytosanitary certificate": "phytosanitary_certificate",
  "Fumigation certificate": "fumigation_certificate",
  "Health certificate": "health_certificate",
  "Quality / inspection certificate": "quality_certificate",
  "Certificate of origin": "certificate_of_origin",
};
const ANY_PERISHABLE: DocType[] = ["phytosanitary_certificate", "fumigation_certificate", "health_certificate", "quality_certificate", "certificate_of_origin"];

export const DOC_RULES: DocRule[] = [
  { key: "shipping_bill", label: "Shipping bill", anyOf: ["shipping_bill"], why: () => "Every export is declared to customs on a shipping bill." },
  { key: "commercial_invoice", label: "Commercial invoice", anyOf: ["commercial_invoice"], why: () => "Customs and the buyer value the goods from the invoice." },
  { key: "packing_list", label: "Packing list", anyOf: ["packing_list"], why: () => "Customs examines and the terminal counts packages against the packing list." },
  { key: "eway_bill", label: "E-way bill", anyOf: ["eway_bill"], why: () => "Goods moving by road to the port need an e-way bill." },
  { key: "lorry_receipt", label: "Lorry receipt", anyOf: ["lorry_receipt"], why: () => "The transporter's receipt shows which truck carries the goods to the gate." },
  {
    key: "insurance_certificate",
    label: "Insurance certificate",
    anyOf: ["insurance_certificate"],
    why: (c) => (c.incoterm === "CIF" || c.incoterm === "CIP" ? `Under ${c.incoterm} the seller buys the cargo insurance, so the buyer expects the policy or certificate.` : null),
  },
  {
    key: "health_certificate",
    label: "Health certificate",
    anyOf: ["health_certificate"],
    why: (c) => (inChapters(c, 1, 5, [16]) ? "Animal products (HS chapters 01–05 and 16) usually need a health certificate from the exporting authority." : null),
  },
  {
    key: "phytosanitary_certificate",
    label: "Phytosanitary certificate",
    anyOf: ["phytosanitary_certificate"],
    why: (c) => (inChapters(c, 6, 14) ? "Plant products (HS chapters 06–14) usually need a phytosanitary certificate." : null),
  },
  { key: "msds", label: "MSDS", anyOf: ["msds"], why: (c) => (c.hazmat ? "Hazardous cargo travels with its material safety data sheet." : null) },
  { key: "temperature_spec", label: "Temperature spec", anyOf: ["temperature_spec"], why: (c) => (c.pharma ? "Pharma cargo needs its storage and transit temperatures on paper." : null) },
  {
    key: "perishable_certificate",
    label: "Perishable certificate",
    anyOf: ANY_PERISHABLE,
    why: (c) => (c.perishable ? "The case is marked perishable, with this certificate." : null),
  },
];

export type DocNeed = { key: string; label: string; anyOf: readonly DocType[]; reason: string };

/** The rules that apply to this case, most basic first. Two rules asking for the same document are merged. */
export function applyDocRules(c: RuleCase): DocNeed[] {
  const out: DocNeed[] = [];
  for (const r of DOC_RULES) {
    const reason = r.why(c);
    if (!reason) continue;
    let anyOf = r.anyOf;
    let label = r.label;
    if (r.key === "perishable_certificate") {
      const picked = (c.perishable as { certificateType?: string } | null)?.certificateType;
      const t = picked ? PERISHABLE_TYPE[picked] : undefined;
      if (t) {
        anyOf = [t];
        label = picked!;
      }
    }
    // A perishable case that picked the phytosanitary or health certificate already asks for it through the HS rule.
    const dup = out.find((n) => n.anyOf.length === 1 && anyOf.length === 1 && n.anyOf[0] === anyOf[0]);
    if (dup) continue;
    out.push({ key: r.key, label, anyOf, reason });
  }
  return out;
}
