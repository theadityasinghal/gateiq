import type { Role } from "@/lib/roles";

/**
 * Every kind of document a case can carry, and which account types may add it.
 * Any number of each can sit on a case, from different people. None is treated as the truth:
 * the later gate checks compare them with each other and with what is found at the gate.
 */
export const DOC_TYPE_KEYS = [
  "shipping_bill",
  "eway_bill",
  "lorry_receipt",
  "commercial_invoice",
  "packing_list",
  "msds",
  "temperature_spec",
  "quality_certificate",
  "fumigation_certificate",
] as const;

export type DocType = (typeof DOC_TYPE_KEYS)[number];

/** "structured": typed in through a form (an optional scan can be attached). "file": an uploaded scan or PDF. */
export type DocForm = "structured" | "file";

export const DOC_TYPES: Record<DocType, { label: string; short: string; form: DocForm; issuers: readonly Role[]; blurb: string }> = {
  shipping_bill: {
    label: "Shipping bill",
    short: "SB",
    form: "structured",
    issuers: ["consignor", "cha"],
    blurb: "The export declaration filed on ICEGATE.",
  },
  eway_bill: {
    label: "E-way bill",
    short: "EWB",
    form: "structured",
    issuers: ["consignor", "transporter", "consignee"],
    blurb: "Generated on the GST portal for road movement. Part B carries the vehicle.",
  },
  lorry_receipt: {
    label: "Lorry receipt",
    short: "LR",
    form: "structured",
    issuers: ["transporter"],
    blurb: "Issued by the transporter when the goods are loaded on a truck.",
  },
  commercial_invoice: {
    label: "Commercial invoice",
    short: "INV",
    form: "file",
    issuers: ["consignor", "cha"],
    blurb: "The seller's invoice for the goods.",
  },
  packing_list: {
    label: "Packing list",
    short: "PL",
    form: "file",
    issuers: ["consignor", "cha"],
    blurb: "What is in each package, with weights.",
  },
  msds: {
    label: "MSDS",
    short: "MSDS",
    form: "file",
    issuers: ["consignor"],
    blurb: "Material safety data sheet, for hazardous cargo.",
  },
  temperature_spec: {
    label: "Temperature spec",
    short: "TEMP",
    form: "file",
    issuers: ["consignor"],
    blurb: "Storage and transit temperature requirements, for pharma.",
  },
  quality_certificate: {
    label: "Quality certificate",
    short: "QC",
    form: "file",
    issuers: ["consignor"],
    blurb: "Quality or inspection certificate.",
  },
  fumigation_certificate: {
    label: "Fumigation certificate",
    short: "FUM",
    form: "file",
    issuers: ["consignor"],
    blurb: "Fumigation certificate, for perishables and wooden packing.",
  },
};

/** The label for use mid-sentence: "e-way bill", "packing list", but "MSDS" stays as it is. */
export function docLabelInline(type: DocType): string {
  const l = DOC_TYPES[type].label;
  return /^[A-Z][a-z]/.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l;
}

export function isDocType(value: unknown): value is DocType {
  return typeof value === "string" && (DOC_TYPE_KEYS as readonly string[]).includes(value);
}

export function canAddDocument(role: Role, type: DocType): boolean {
  return DOC_TYPES[type].issuers.includes(role);
}

export function addableTypes(role: Role): DocType[] {
  return DOC_TYPE_KEYS.filter((t) => canAddDocument(role, t));
}

/** URL segment for a type: shipping_bill ↔ shipping-bill. */
export function docTypeSlug(type: DocType): string {
  return type.replace(/_/g, "-");
}

export function docTypeFromSlug(slug: string): DocType | null {
  const t = slug.replace(/-/g, "_");
  return isDocType(t) ? t : null;
}
