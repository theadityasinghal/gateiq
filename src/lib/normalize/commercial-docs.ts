/**
 * Normalisers for the seller's commercial invoice and packing list. Same contract as the others.
 */
import type { InvoiceFormInput, PackingListFormInput } from "@/lib/case-schema";
import { alnum, normalizePartyName, round, toIsoDate } from "./shipping-bill";

type Result<N> = { normalized: N; provenance: Record<string, string> };

export type NormalizedInvoice = {
  documentNumber: string;
  documentDate: string;
  exporterGstin: string | null;
  buyerName: string;
  destinationCountry: string | null;
  currency: string;
  irn: string | null;
  totals: { value: number };
  lines: Array<{ lineNo: number; description: string; hsCode: string; quantity: number; uqc: string; value: number }>;
};

export function normalizeInvoice(input: InvoiceFormInput): Result<NormalizedInvoice> {
  const lines = input.lines.map((l, i) => ({
    lineNo: i + 1,
    description: l.description.trim().replace(/\s+/g, " "),
    hsCode: l.hsCode.replace(/[\s.]/g, ""),
    quantity: round(l.quantity, 3),
    uqc: l.uqc.toUpperCase(),
    value: round(l.value, 2),
  }));
  return {
    normalized: {
      documentNumber: input.invoiceNumber.trim().toUpperCase(),
      documentDate: toIsoDate(input.invoiceDate),
      exporterGstin: input.exporterGstin ? alnum(input.exporterGstin) : null,
      buyerName: normalizePartyName(input.buyerName),
      destinationCountry: input.destinationCountry?.toUpperCase() ?? null,
      currency: input.currency.toUpperCase(),
      irn: input.irn ?? null,
      totals: { value: round(lines.reduce((s, l) => s + l.value, 0), 2) },
      lines,
    },
    provenance: {
      documentNumber: "input.invoiceNumber (uppercased)",
      documentDate: "input.invoiceDate (converted to ISO)",
      buyerName: "input.buyerName (case-folded, suffixes standardised)",
      "totals.value": "sum of input.lines[].value",
    },
  };
}

export type NormalizedPackingList = {
  documentNumber: string; // the invoice it belongs to
  documentDate: string | null;
  totals: { packages: number; grossWeightT: number; netWeightT: number | null };
  containerNumbers: string[];
};

export function normalizePackingList(input: PackingListFormInput): Result<NormalizedPackingList> {
  const t = (v: number) => round(input.weightUnit === "KGS" ? v / 1000 : v, 3);
  return {
    normalized: {
      documentNumber: input.invoiceNumber.trim().toUpperCase(),
      documentDate: input.invoiceDate ? toIsoDate(input.invoiceDate) : null,
      totals: { packages: input.totalPackages, grossWeightT: t(input.grossWeight), netWeightT: input.netWeight != null ? t(input.netWeight) : null },
      containerNumbers: input.containers.map((c) => alnum(c.containerNo)),
    },
    provenance: {
      documentNumber: "input.invoiceNumber (uppercased)",
      "totals.grossWeightT": `input.grossWeight (${input.weightUnit} → t)`,
      "totals.netWeightT": `input.netWeight (${input.weightUnit} → t)`,
    },
  };
}
