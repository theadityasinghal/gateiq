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
  "form_13",
  "vgm_declaration",
  "e_seal",
  "commercial_invoice",
  "packing_list",
  "msds",
  "temperature_spec",
  "quality_certificate",
  "fumigation_certificate",
] as const;

export type DocType = (typeof DOC_TYPE_KEYS)[number];

/**
 * "structured": its fields are recorded (typed in, or read from a photo and confirmed) and compared with the
 * other documents; a scan can be attached. "file": an uploaded scan or PDF only.
 */
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
  form_13: {
    label: "Form-13",
    short: "F13",
    form: "structured",
    issuers: ["consignor", "cha", "transporter"],
    blurb: "The shipping line's permission for one container to enter the terminal (e-Form-13).",
  },
  vgm_declaration: {
    label: "VGM declaration",
    short: "VGM",
    form: "structured",
    issuers: ["consignor", "cha"],
    blurb: "The weighed gross mass of each packed container, including the container itself, given to the shipping line.",
  },
  e_seal: {
    label: "E-seal record",
    short: "SEAL",
    form: "structured",
    issuers: ["consignor"],
    blurb: "What was uploaded through the e-seal vendor's app when the container was sealed.",
  },
  commercial_invoice: {
    label: "Commercial invoice",
    short: "INV",
    form: "structured",
    issuers: ["consignor", "cha"],
    blurb: "The seller's invoice for the goods.",
  },
  packing_list: {
    label: "Packing list",
    short: "PL",
    form: "structured",
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

/**
 * The label for use mid-sentence: "e-way bill", "e-seal record", "packing list". Acronyms ("MSDS",
 * "VGM declaration") and names with a number ("Form-13") stay as they are.
 */
export function docLabelInline(type: DocType): string {
  const l = DOC_TYPES[type].label;
  if (/\d/.test(l)) return l;
  return /^[A-Z]([a-z]|-[a-z])/.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l;
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
