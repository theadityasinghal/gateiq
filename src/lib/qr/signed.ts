/**
 * Which saved values a signed e-invoice QR vouches for. Only fields saved exactly as the signed QR gave them
 * count: a field the adder changed is recorded as edited and is no longer signed. Pure, so it is tested alone.
 */
import type { FactKey } from "@/lib/checks/types";

/** Form fields of a commercial invoice that a signed e-invoice QR carries, and the fact each one is. */
export const SIGNED_FIELD_FACT: Record<string, FactKey> = {
  invoiceNumber: "invoice.number",
  invoiceDate: "invoice.date",
  exporterGstin: "exporter.gstin",
};

const same = (a: unknown, b: unknown) => String(a ?? "").trim().toUpperCase() === String(b ?? "").trim().toUpperCase();

export type SignedRecord = { status: "verified"; facts: FactKey[]; edited: string[] };

export function signedFields(signedValues: Record<string, string>, form: unknown): SignedRecord {
  const f = (form && typeof form === "object" ? form : {}) as Record<string, unknown>;
  const facts: FactKey[] = [];
  const edited: string[] = [];
  for (const [field, fact] of Object.entries(SIGNED_FIELD_FACT)) {
    if (!(field in signedValues)) continue;
    if (same(signedValues[field], f[field])) facts.push(fact);
    else edited.push(field);
  }
  return { status: "verified", facts, edited };
}

/** The facts a stored submission's signed QR vouches for, read back from its raw record. */
export function signedFactsOf(raw: unknown): FactKey[] {
  const s = raw && typeof raw === "object" ? (raw as { signed?: { facts?: unknown } }).signed : undefined;
  return Array.isArray(s?.facts) ? s.facts.filter((x): x is FactKey => Object.values(SIGNED_FIELD_FACT).includes(x as FactKey)) : [];
}
