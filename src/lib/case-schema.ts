import { z } from "zod";
import { INCOTERM_CODES, PERISHABLE_CERTIFICATES } from "./incoterms";

const text = (label: string, max = 300) => z.string().trim().min(1, `${label} is required.`).max(max);
const positive = (label: string) =>
  z.coerce.number({ error: `${label} must be a number.` }).positive(`${label} must be more than 0.`).max(1e12);
const nonNegative = (label: string) =>
  z.coerce.number({ error: `${label} must be a number.` }).min(0, `${label} can't be negative.`).max(1e12);

export const HS_RE = /^\d{8}$/;
export const PORT_RE = /^IN[A-Z]{3}[0-9A-Z]$/;
export const UN_RE = /^UN\d{4}$/;
export const HAZARD_CLASS_RE = /^[1-9](\.[1-6])?$/;
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
/** Indian registration plates, after stripping spaces and hyphens: KA01AB1234, DL1CAB1234, 22BH1234AA. */
export const VEHICLE_RE = /^([A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
const isoDate = (msg: string) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, msg);
const compact = (v: string) => v.toUpperCase().replace(/[\s-]/g, "");

export const goodsLineSchema = z
  .object({
    description: text("Description", 500),
    hsCode: z.string().trim().regex(HS_RE, "HS code must be 8 digits (ITC-HS)."),
    quantity: positive("Quantity"),
    uqc: text("Unit"),
    netWeight: positive("Net weight"),
    grossWeight: positive("Gross weight"),
    weightUnit: text("Weight unit"),
    packages: z.coerce.number().int("Packages must be a whole number.").positive("Packages must be at least 1."),
    packageType: text("Package type", 60),
    value: nonNegative("Value"),
  })
  .refine((l) => l.grossWeight >= l.netWeight, { message: "Gross weight can't be less than net weight.", path: ["grossWeight"] });

export const caseSchema = z
  .object({
    originPlace: text("Origin", 200),
    exportPortCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(PORT_RE, "Use the 6-character customs location code, e.g. IN + 3 letters + 1 character."),
    destinationCountry: z.string().trim().length(2, "Choose a country."),
    destinationPort: z.string().trim().max(120).optional().transform((v) => v || undefined),
    incoterm: z.enum(INCOTERM_CODES, { error: "Choose an Incoterm." }),
    currency: z.string().trim().length(3, "Choose a currency."),
    lines: z.array(goodsLineSchema).min(1, "Add at least one goods line.").max(100),
    hazmat: z
      .object({
        unNumber: z.string().trim().toUpperCase().regex(UN_RE, "UN number looks like UN1234."),
        hazardClass: z.string().trim().regex(HAZARD_CLASS_RE, "Hazard class is 1 to 9, optionally with a division (e.g. 2.1)."),
      })
      .nullable(),
    pharma: z
      .object({ minC: z.coerce.number().min(-100).max(100), maxC: z.coerce.number().min(-100).max(100) })
      .refine((p) => p.maxC >= p.minC, { message: "Maximum must be at least the minimum.", path: ["maxC"] })
      .nullable(),
    perishable: z.object({ certificateType: z.enum(PERISHABLE_CERTIFICATES, { error: "Choose a certificate type." }) }).nullable(),
  });

export type CaseInput = z.infer<typeof caseSchema>;
export type GoodsLineInput = z.input<typeof goodsLineSchema>;

export const filingLineSchema = z.object({
  description: text("Description", 500),
  hsCode: z.string().trim().regex(HS_RE, "HS code must be 8 digits (ITC-HS)."),
  quantity: positive("Quantity"),
  uqc: text("Unit"),
  value: nonNegative("FOB value"),
});

/* ───────────── Shared pieces for container and port documents ───────────── */

/** Blank strings and missing values become null; anything else must pass `s`. */
const opt = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v), s.nullable());
const alnum = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * The written container number is kept even when its check digit fails: the point is to record what the
 * paper says, and the checks then flag it. Only the shape (4 letters, 7 digits) is enforced here.
 */
export const containerNoField = z
  .string({ error: "Enter the container number." })
  .trim()
  .transform(alnum)
  .pipe(z.string().regex(/^[A-Z]{3}[UJZ]\d{7}$/, "Container numbers are 4 letters and 7 digits, e.g. MSKU 123456 5."));
export const sizeTypeField = z
  .string()
  .trim()
  .transform(alnum)
  .pipe(z.string().regex(/^[24L][0-9][A-Z0-9][0-9]$/, "Size/type is 4 characters, e.g. 22G1, 45G1 or 2210."));
export const sealNoField = z
  .string()
  .trim()
  .transform(alnum)
  .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, "Seal numbers are 4 to 20 letters and digits."));
const sbNumberField = z.string().trim().regex(/^\d{5,10}$/, "Shipping bill numbers are 5 to 10 digits.");
const vehicleField = z.string().trim().transform(compact).pipe(z.string().regex(VEHICLE_RE, "Use the registration as printed, e.g. MH04AB1234."));
const iecField = z.string().trim().transform(alnum).pipe(z.string().length(10, "IEC is 10 characters."));
const notFuture = (d: string | null | undefined) => !d || d <= new Date().toISOString().slice(0, 10);

export const sbContainerSchema = z.object({
  containerNo: containerNoField,
  sizeType: opt(sizeTypeField),
  sealNo: opt(sealNoField),
});

export const shippingBillSchema = z
  .object({
    sbNumber: z.string().trim().regex(/^\d{5,10}$/, "Enter the shipping bill number as shown on ICEGATE (digits only)."),
    sbDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the shipping bill date."),
    portCode: z.string().trim().toUpperCase().regex(PORT_RE, "Use the 6-character customs location code."),
    exporterIec: z.string().trim().toUpperCase().min(10, "IEC is 10 characters.").max(10, "IEC is 10 characters."),
    exporterGstin: z.string().trim().toUpperCase().optional().transform((v) => v || null),
    consigneeName: text("Consignee name", 200),
    currency: z.string().trim().length(3, "Choose a currency."),
    totalPackages: z.coerce.number().int("Packages must be a whole number.").positive("Packages must be at least 1."),
    grossWeight: positive("Gross weight"),
    netWeight: positive("Net weight"),
    weightUnit: text("Weight unit"),
    lines: z.array(filingLineSchema).min(1, "Add at least one item line.").max(200),
    /** "Container details, if factory stuffed": optional, any number of rows. */
    containers: z.array(sbContainerSchema).max(50).default([]),
  })
  .refine((s) => s.grossWeight >= s.netWeight, { message: "Gross weight can't be less than net weight.", path: ["grossWeight"] })
  .refine((s) => s.sbDate <= new Date().toISOString().slice(0, 10), { message: "The date can't be in the future.", path: ["sbDate"] });

export type ShippingBillFormInput = z.infer<typeof shippingBillSchema>;

export const EWB_DOC_TYPES = ["INV", "BIL", "CHL", "OTH"] as const;
export const EWB_DOC_TYPE_LABEL: Record<(typeof EWB_DOC_TYPES)[number], string> = {
  INV: "Tax invoice",
  BIL: "Bill of supply",
  CHL: "Delivery challan",
  OTH: "Others",
};
export const EWB_TRANSPORT_MODES = ["ROAD", "RAIL", "AIR", "SHIP"] as const;

export const ewayLineSchema = z.object({
  description: text("Product name", 500),
  hsCode: z.string().trim().regex(/^\d{4,8}$/, "HSN on the e-way bill is 4 to 8 digits."),
  quantity: positive("Quantity"),
  uqc: text("Unit"),
  value: nonNegative("Taxable value"),
});

export const ewayBillSchema = z
  .object({
    ewbNumber: z.string().trim().transform((v) => v.replace(/\s/g, "")).pipe(z.string().regex(/^\d{12}$/, "The e-way bill number is 12 digits.")),
    ewbDate: isoDate("Choose the date the e-way bill was generated."),
    validUntil: z.string().trim().optional().transform((v) => v || null)
      .pipe(isoDate("Choose a valid date.").nullable()),
    fromGstin: z.string().trim().transform(compact).pipe(z.string().regex(GSTIN_RE, "Enter the 15-character GSTIN of the supplier.")),
    toGstin: z.string().trim().transform(compact)
      .pipe(z.string().refine((v) => v === "URP" || GSTIN_RE.test(v), "Enter a 15-character GSTIN, or URP for an unregistered or overseas recipient.")),
    fromPincode: z.string().trim().regex(/^[1-9]\d{5}$/, "PIN code is 6 digits."),
    toPincode: z.string().trim().regex(/^[1-9]\d{5}$/, "PIN code is 6 digits."),
    docType: z.enum(EWB_DOC_TYPES, { error: "Choose the document type." }),
    docNumber: text("Document number", 16),
    docDate: isoDate("Choose the document date."),
    transportMode: z.enum(EWB_TRANSPORT_MODES, { error: "Choose the transport mode." }),
    distanceKm: z.coerce.number({ error: "Distance must be a number." }).int("Distance is in whole kilometres.").min(0).max(4000, "Distance can't be more than 4000 km."),
    transporterId: z.string().trim().transform(compact).optional().transform((v) => v || null)
      .pipe(z.string().regex(GSTIN_RE, "Transporter ID is a 15-character GSTIN or TRANSIN.").nullable()),
    vehicleNumber: z.string().trim().transform(compact).optional().transform((v) => v || null)
      .pipe(z.string().regex(VEHICLE_RE, "Use the registration as printed, e.g. MH04AB1234.").nullable()),
    lines: z.array(ewayLineSchema).min(1, "Add at least one item line.").max(200),
  })
  .refine((s) => s.ewbDate <= new Date().toISOString().slice(0, 10), { message: "The date can't be in the future.", path: ["ewbDate"] })
  .refine((s) => s.docDate <= s.ewbDate, { message: "The document date can't be after the e-way bill date.", path: ["docDate"] })
  .refine((s) => !s.validUntil || s.validUntil >= s.ewbDate, { message: "Valid until can't be before the e-way bill date.", path: ["validUntil"] });

export type EwayBillFormInput = z.infer<typeof ewayBillSchema>;

export const lorryReceiptSchema = z
  .object({
    lrNumber: z.string().trim().toUpperCase().min(1, "Enter the LR number.").max(30, "LR number is at most 30 characters."),
    lrDate: isoDate("Choose the LR date."),
    vehicleNumber: z.string().trim().transform(compact).pipe(z.string().regex(VEHICLE_RE, "Use the registration as printed, e.g. MH04AB1234.")),
    driverName: z.string().trim().max(120).optional().transform((v) => v || null),
    /** E.164 after parsing on the server; blank when not known. */
    driverPhone: z.string().trim().max(20).optional().transform((v) => v || null),
    driverPhoneCountry: z.string().trim().optional().transform((v) => v || "IN"),
    fromPlace: text("From", 120),
    toPlace: text("To", 120),
    packages: z.coerce.number().int("Packages must be a whole number.").positive("Packages must be at least 1."),
    goodsDescription: text("Description of goods", 300),
    chargedWeight: positive("Charged weight"),
    weightUnit: z.enum(["KGS", "MTS"], { error: "Choose kg or tonnes." }),
    containers: z.array(z.object({ containerNo: containerNoField })).max(4).default([]),
  })
  .refine((s) => s.lrDate <= new Date().toISOString().slice(0, 10), { message: "The date can't be in the future.", path: ["lrDate"] });

export type LorryReceiptFormInput = z.infer<typeof lorryReceiptSchema>;

/* ───────────── Port documents ───────────── */

/** e-Form-13: the shipping line's permission for one container to enter the terminal. */
export const form13Schema = z
  .object({
    bookingNo: z.string().trim().transform(alnum).pipe(z.string().min(4, "Enter the booking number.").max(30)),
    containerNo: containerNoField,
    isoCode: opt(sizeTypeField),
    lineSealNo: opt(sealNoField),
    eSealNo: opt(sealNoField),
    vgm: positive("VGM"),
    vgmUnit: z.enum(["KGS", "MTS"], { error: "Choose kg or tonnes." }),
    sbNumber: opt(sbNumberField),
    chaLicence: opt(z.string().trim().toUpperCase().max(30)),
    shipperName: opt(z.string().trim().max(200)),
    pod: opt(z.string().trim().transform(alnum).pipe(z.string().length(5, "Port of discharge is a 5-character UN/LOCODE, e.g. AEJEA."))),
    vesselCall: opt(z.string().trim().toUpperCase().max(30)),
    vehicleNumber: opt(vehicleField),
    issuedOn: opt(isoDate("Choose a valid date.")),
  })
  .refine((s) => notFuture(s.issuedOn), { message: "The date can't be in the future.", path: ["issuedOn"] });
export type Form13FormInput = z.infer<typeof form13Schema>;

/** VGM declaration (SOLAS): the weighed gross mass of each packed container, including its tare. */
export const vgmSchema = z
  .object({
    bookingNo: z.string().trim().transform(alnum).pipe(z.string().min(4, "Enter the booking number.").max(30)),
    shipperName: text("Shipper name", 200),
    shipperIec: opt(iecField),
    method: z.enum(["1", "2"], { error: "Choose method 1 or 2." }),
    weighingSlipNo: opt(z.string().trim().toUpperCase().max(30)),
    weighbridgeRegNo: opt(z.string().trim().toUpperCase().max(40)),
    weighedOn: isoDate("Choose the date of weighing."),
    containers: z
      .array(
        z.object({
          containerNo: containerNoField,
          vgmKg: positive("VGM"),
          tareKg: opt(positive("Tare")),
        }),
      )
      .min(1, "Add at least one container.")
      .max(50),
  })
  .refine((s) => notFuture(s.weighedOn), { message: "The date can't be in the future.", path: ["weighedOn"] });
export type VgmFormInput = z.infer<typeof vgmSchema>;

/** RFID e-seal record uploaded through the seal vendor's app when a self-sealed container is closed. */
export const eSealSchema = z
  .object({
    eSealNo: sealNoField,
    containerNo: containerNoField,
    sbNumber: sbNumberField,
    sbDate: isoDate("Choose the shipping bill date."),
    iec: iecField,
    truckNumber: opt(vehicleField),
    sealedOn: isoDate("Choose the date of sealing."),
  })
  .refine((s) => notFuture(s.sealedOn), { message: "The date can't be in the future.", path: ["sealedOn"] })
  .refine((s) => notFuture(s.sbDate), { message: "The date can't be in the future.", path: ["sbDate"] });
export type ESealFormInput = z.infer<typeof eSealSchema>;

/* ───────────── Commercial documents ───────────── */

export const invoiceLineSchema = z.object({
  description: text("Description", 500),
  hsCode: z.string().trim().transform((v) => v.replace(/[\s.]/g, "")).pipe(z.string().regex(/^\d{4,8}$/, "HSN is 4 to 8 digits.")),
  quantity: positive("Quantity"),
  uqc: text("Unit"),
  value: nonNegative("Value"),
});

export const invoiceSchema = z
  .object({
    invoiceNumber: z.string().trim().toUpperCase().min(1, "Enter the invoice number.").max(16, "GST invoice numbers are at most 16 characters."),
    invoiceDate: isoDate("Choose the invoice date."),
    exporterGstin: opt(z.string().trim().transform(compact).pipe(z.string().regex(GSTIN_RE, "Enter the 15-character GSTIN."))),
    buyerName: text("Buyer name", 200),
    destinationCountry: opt(z.string().trim().toUpperCase().length(2, "Choose a country.")),
    currency: z.string().trim().toUpperCase().length(3, "Choose a currency."),
    irn: opt(z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/, "The IRN is 64 characters (letters a–f and digits).")),
    lines: z.array(invoiceLineSchema).min(1, "Add at least one item line.").max(200),
  })
  .refine((s) => notFuture(s.invoiceDate), { message: "The date can't be in the future.", path: ["invoiceDate"] });
export type InvoiceFormInput = z.infer<typeof invoiceSchema>;

export const packingListSchema = z
  .object({
    invoiceNumber: z.string().trim().toUpperCase().min(1, "Enter the invoice number it belongs to.").max(16),
    invoiceDate: opt(isoDate("Choose a valid date.")),
    totalPackages: z.coerce.number().int("Packages must be a whole number.").positive("Packages must be at least 1."),
    grossWeight: positive("Gross weight"),
    netWeight: opt(positive("Net weight")),
    weightUnit: z.enum(["KGS", "MTS"], { error: "Choose kg or tonnes." }),
    containers: z.array(z.object({ containerNo: containerNoField })).max(50).default([]),
  })
  .refine((s) => s.netWeight == null || s.grossWeight >= s.netWeight, { message: "Gross weight can't be less than net weight.", path: ["grossWeight"] })
  .refine((s) => notFuture(s.invoiceDate), { message: "The date can't be in the future.", path: ["invoiceDate"] });
export type PackingListFormInput = z.infer<typeof packingListSchema>;

/** Flattens zod issues into "a.b.0.c" → message, for showing next to fields. */
export function issuesToFieldErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
