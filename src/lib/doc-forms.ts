/**
 * What each structured document's form asks for, as data. One form component renders all of them, so
 * typing a document in, correcting it, and confirming what was read from a photo all look the same.
 * Field keys match the zod schemas in case-schema.ts; repeated rows post as arrays of objects.
 */
import { EWB_DOC_TYPES, EWB_DOC_TYPE_LABEL, EWB_TRANSPORT_MODES } from "@/lib/case-schema";
import type { DocType } from "@/lib/documents";

export type OptionSource = "currencies" | "uqc" | "massUnits" | "phoneCountries";
export type StaticOption = { value: string; label: string };

export type FieldKind = "text" | "code" | "number" | "integer" | "date" | "select" | "container";

export type FieldSpec = {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: OptionSource | readonly StaticOption[];
  /** Columns this field spans in its grid. */
  span?: 1 | 2 | 3 | 4;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  /** Dates that can't be after today. */
  noFuture?: boolean;
  defaultValue?: string;
  /** Strip anything but digits as the user types (HS codes, numbers that are IDs). */
  digitsOnly?: boolean;
};

export type GroupSpec = { kind: "group"; title: string; description?: string; cols: 2 | 3 | 4; fields: FieldSpec[] };
export type RepeatSpec = {
  kind: "repeat";
  key: string;
  title: string;
  description?: string;
  itemLabel: string;
  addLabel: string;
  min: number;
  max: number;
  cols: 2 | 3 | 4 | 5;
  fields: FieldSpec[];
};
export type FormSpec = { sections: Array<GroupSpec | RepeatSpec>; submitLabel: string };

/**
 * Where a pre-filled value came from, keyed by field path ("sbNumber", "lines.0.hsCode").
 * "qr": decoded from a QR code on the document. "model": read from the image by the vision model.
 */
export type FieldMeta = { source: "qr" | "model"; confidence?: number; asWritten?: string | null; problem?: string | null };

/** Model readings below this are highlighted for the person confirming them. */
export const LOW_CONFIDENCE = 0.8;

const KG_T: readonly StaticOption[] = [
  { value: "KGS", label: "kg" },
  { value: "MTS", label: "tonnes" },
];

const containerRows = (min: number, max: number, description: string): RepeatSpec => ({
  kind: "repeat",
  key: "containers",
  title: "Containers",
  description,
  itemLabel: "Container",
  addLabel: "Add container",
  min,
  max,
  cols: 3,
  fields: [{ key: "containerNo", label: "Container number", kind: "container" }],
});

export const DOC_FORMS: Partial<Record<DocType, FormSpec>> = {
  shipping_bill: {
    submitLabel: "Add shipping bill",
    sections: [
      {
        kind: "group",
        title: "Shipping bill",
        cols: 3,
        fields: [
          { key: "sbNumber", label: "SB number", kind: "code", digitsOnly: true, maxLength: 10 },
          { key: "sbDate", label: "SB date", kind: "date", noFuture: true },
          { key: "portCode", label: "Port code", kind: "code", maxLength: 6 },
          { key: "exporterIec", label: "Exporter IEC", kind: "code", maxLength: 10 },
          { key: "exporterGstin", label: "Exporter GSTIN (if shown)", kind: "code", maxLength: 15 },
          { key: "currency", label: "Currency", kind: "select", options: "currencies" },
          { key: "consigneeName", label: "Consignee name", span: 3 },
        ],
      },
      {
        kind: "group",
        title: "Packages and weight",
        description: "The totals printed on the shipping bill.",
        cols: 4,
        fields: [
          { key: "totalPackages", label: "Total packages", kind: "integer" },
          { key: "grossWeight", label: "Gross weight", kind: "number" },
          { key: "netWeight", label: "Net weight", kind: "number" },
          { key: "weightUnit", label: "Weight unit", kind: "select", options: "massUnits", defaultValue: "KGS" },
        ],
      },
      {
        kind: "repeat",
        key: "lines",
        title: "Item lines",
        itemLabel: "Item",
        addLabel: "Add item",
        min: 1,
        max: 200,
        cols: 5,
        fields: [
          { key: "description", label: "Description", span: 2 },
          { key: "hsCode", label: "HS code", kind: "code", digitsOnly: true, maxLength: 10 },
          { key: "quantity", label: "Quantity", kind: "number" },
          { key: "uqc", label: "Unit (UQC)", kind: "select", options: "uqc" },
          { key: "value", label: "FOB value", kind: "number" },
        ],
      },
      {
        kind: "repeat",
        key: "containers",
        title: "Container details (factory-stuffed)",
        description: "As listed on the shipping bill. Leave empty for cargo stuffed at a CFS.",
        itemLabel: "Container",
        addLabel: "Add container",
        min: 0,
        max: 50,
        cols: 3,
        fields: [
          { key: "containerNo", label: "Container number", kind: "container" },
          { key: "sizeType", label: "Size/type", kind: "code", maxLength: 4, placeholder: "22G1" },
          { key: "sealNo", label: "Seal no. (e-seal)", kind: "code", maxLength: 24 },
        ],
      },
    ],
  },

  eway_bill: {
    submitLabel: "Add e-way bill",
    sections: [
      {
        kind: "group",
        title: "E-way bill",
        cols: 3,
        fields: [
          { key: "ewbNumber", label: "E-way bill number", kind: "code", digitsOnly: true, maxLength: 12 },
          { key: "ewbDate", label: "Generated on", kind: "date", noFuture: true },
          { key: "validUntil", label: "Valid until (if shown)", kind: "date" },
          { key: "fromGstin", label: "Supplier GSTIN", kind: "code", maxLength: 15 },
          { key: "fromPincode", label: "Dispatch PIN", kind: "code", digitsOnly: true, maxLength: 6 },
          { key: "toGstin", label: "Recipient GSTIN", kind: "code", maxLength: 15, defaultValue: "URP", hint: "URP for an overseas or unregistered buyer." },
          { key: "toPincode", label: "Delivery PIN", kind: "code", digitsOnly: true, maxLength: 6, hint: "For an export, the port or CFS." },
        ],
      },
      {
        kind: "group",
        title: "Document and transport",
        cols: 3,
        fields: [
          { key: "docType", label: "Document type", kind: "select", options: EWB_DOC_TYPES.map((v) => ({ value: v, label: EWB_DOC_TYPE_LABEL[v] })), defaultValue: "INV" },
          { key: "docNumber", label: "Document number", kind: "code", maxLength: 16 },
          { key: "docDate", label: "Document date", kind: "date", noFuture: true },
          {
            key: "transportMode",
            label: "Mode",
            kind: "select",
            options: EWB_TRANSPORT_MODES.map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() })),
            defaultValue: "ROAD",
          },
          { key: "distanceKm", label: "Distance (km)", kind: "integer" },
          { key: "transporterId", label: "Transporter ID (if shown)", kind: "code", maxLength: 15 },
          { key: "vehicleNumber", label: "Vehicle number (Part B)", kind: "code", maxLength: 13, placeholder: "MH04AB1234", hint: "Leave empty if Part B isn't filled in yet." },
        ],
      },
      {
        kind: "repeat",
        key: "lines",
        title: "Item lines",
        itemLabel: "Item",
        addLabel: "Add item",
        min: 1,
        max: 200,
        cols: 5,
        fields: [
          { key: "description", label: "Product name", span: 2 },
          { key: "hsCode", label: "HSN", kind: "code", digitsOnly: true, maxLength: 8 },
          { key: "quantity", label: "Quantity", kind: "number" },
          { key: "uqc", label: "Unit (UQC)", kind: "select", options: "uqc" },
          { key: "value", label: "Taxable value (INR)", kind: "number" },
        ],
      },
    ],
  },

  lorry_receipt: {
    submitLabel: "Add lorry receipt",
    sections: [
      {
        kind: "group",
        title: "Lorry receipt",
        cols: 3,
        fields: [
          { key: "lrNumber", label: "LR number", kind: "code", maxLength: 30 },
          { key: "lrDate", label: "LR date", kind: "date", noFuture: true },
          { key: "vehicleNumber", label: "Vehicle number", kind: "code", maxLength: 13, placeholder: "MH04AB1234" },
          { key: "fromPlace", label: "From" },
          { key: "toPlace", label: "To" },
        ],
      },
      {
        kind: "group",
        title: "Driver",
        description: "If known. It helps the gate match the truck and driver to this case.",
        cols: 3,
        fields: [
          { key: "driverName", label: "Driver name" },
          { key: "driverPhoneCountry", label: "Country code", kind: "select", options: "phoneCountries", defaultValue: "IN" },
          { key: "driverPhone", label: "Driver mobile" },
        ],
      },
      {
        kind: "group",
        title: "Goods",
        description: "As written on the LR.",
        cols: 4,
        fields: [
          { key: "goodsDescription", label: "Description of goods", span: 4 },
          { key: "packages", label: "Packages", kind: "integer" },
          { key: "chargedWeight", label: "Charged weight", kind: "number" },
          { key: "weightUnit", label: "Unit", kind: "select", options: KG_T, defaultValue: "KGS" },
        ],
      },
      containerRows(0, 4, "If the LR names the container(s) on the truck."),
    ],
  },

  form_13: {
    submitLabel: "Add Form-13",
    sections: [
      {
        kind: "group",
        title: "Container",
        description: "One Form-13 per container, as issued by the shipping line.",
        cols: 3,
        fields: [
          { key: "containerNo", label: "Container number", kind: "container" },
          { key: "isoCode", label: "ISO size/type", kind: "code", maxLength: 4, placeholder: "22G1" },
          { key: "bookingNo", label: "Booking number", kind: "code", maxLength: 30 },
          { key: "lineSealNo", label: "Line seal no.", kind: "code", maxLength: 24 },
          { key: "eSealNo", label: "Customs e-seal no.", kind: "code", maxLength: 24 },
          { key: "vgm", label: "VGM (gross, incl. container)", kind: "number" },
          { key: "vgmUnit", label: "VGM unit", kind: "select", options: KG_T, defaultValue: "MTS" },
        ],
      },
      {
        kind: "group",
        title: "Filing and vessel",
        cols: 3,
        fields: [
          { key: "sbNumber", label: "Shipping bill no.", kind: "code", digitsOnly: true, maxLength: 10 },
          { key: "chaLicence", label: "CHA licence / code", kind: "code", maxLength: 30 },
          { key: "shipperName", label: "Shipper name" },
          { key: "pod", label: "Port of discharge", kind: "code", maxLength: 5, placeholder: "AEJEA" },
          { key: "vesselCall", label: "Vessel call (VCN / VIA)", kind: "code", maxLength: 30 },
          { key: "vehicleNumber", label: "Vehicle number (if given)", kind: "code", maxLength: 13 },
          { key: "issuedOn", label: "Issued on", kind: "date", noFuture: true },
        ],
      },
    ],
  },

  vgm_declaration: {
    submitLabel: "Add VGM declaration",
    sections: [
      {
        kind: "group",
        title: "Declaration",
        cols: 3,
        fields: [
          { key: "bookingNo", label: "Booking number", kind: "code", maxLength: 30 },
          { key: "shipperName", label: "Shipper name", span: 2 },
          { key: "shipperIec", label: "Shipper IEC", kind: "code", maxLength: 10 },
          {
            key: "method",
            label: "Method",
            kind: "select",
            options: [
              { value: "1", label: "Method 1: packed container weighed" },
              { value: "2", label: "Method 2: contents + tare added up" },
            ],
            defaultValue: "1",
          },
          { key: "weighedOn", label: "Weighed on", kind: "date", noFuture: true },
          { key: "weighingSlipNo", label: "Weighing slip no.", kind: "code", maxLength: 30 },
          { key: "weighbridgeRegNo", label: "Weighbridge registration no.", kind: "code", maxLength: 40 },
        ],
      },
      {
        kind: "repeat",
        key: "containers",
        title: "Containers",
        description: "VGM includes the empty container. The tare is painted on the container door.",
        itemLabel: "Container",
        addLabel: "Add container",
        min: 1,
        max: 50,
        cols: 3,
        fields: [
          { key: "containerNo", label: "Container number", kind: "container" },
          { key: "vgmKg", label: "VGM (kg)", kind: "number" },
          { key: "tareKg", label: "Tare (kg, if known)", kind: "number" },
        ],
      },
    ],
  },

  e_seal: {
    submitLabel: "Add e-seal record",
    sections: [
      {
        kind: "group",
        title: "Seal",
        description: "Exactly as uploaded through the e-seal vendor's app.",
        cols: 3,
        fields: [
          { key: "eSealNo", label: "E-seal number", kind: "code", maxLength: 24 },
          { key: "containerNo", label: "Container number", kind: "container" },
          { key: "truckNumber", label: "Truck number", kind: "code", maxLength: 13 },
          { key: "sbNumber", label: "Shipping bill no.", kind: "code", digitsOnly: true, maxLength: 10 },
          { key: "sbDate", label: "Shipping bill date", kind: "date", noFuture: true },
          { key: "iec", label: "IEC", kind: "code", maxLength: 10 },
          { key: "sealedOn", label: "Sealed on", kind: "date", noFuture: true },
        ],
      },
    ],
  },

  commercial_invoice: {
    submitLabel: "Add invoice",
    sections: [
      {
        kind: "group",
        title: "Invoice",
        cols: 3,
        fields: [
          { key: "invoiceNumber", label: "Invoice number", kind: "code", maxLength: 16 },
          { key: "invoiceDate", label: "Invoice date", kind: "date", noFuture: true },
          { key: "exporterGstin", label: "Exporter GSTIN", kind: "code", maxLength: 15 },
          { key: "buyerName", label: "Buyer (consignee) name", span: 2 },
          { key: "destinationCountry", label: "Country of destination", kind: "code", maxLength: 2, placeholder: "AE" },
          { key: "currency", label: "Currency", kind: "select", options: "currencies" },
          { key: "irn", label: "IRN (e-invoice, if printed)", kind: "code", maxLength: 64, span: 2 },
        ],
      },
      {
        kind: "repeat",
        key: "lines",
        title: "Item lines",
        itemLabel: "Item",
        addLabel: "Add item",
        min: 1,
        max: 200,
        cols: 5,
        fields: [
          { key: "description", label: "Description", span: 2 },
          { key: "hsCode", label: "HSN", kind: "code", digitsOnly: true, maxLength: 8 },
          { key: "quantity", label: "Quantity", kind: "number" },
          { key: "uqc", label: "Unit (UQC)", kind: "select", options: "uqc" },
          { key: "value", label: "Value", kind: "number" },
        ],
      },
    ],
  },

  packing_list: {
    submitLabel: "Add packing list",
    sections: [
      {
        kind: "group",
        title: "Packing list",
        cols: 3,
        fields: [
          { key: "invoiceNumber", label: "Invoice number", kind: "code", maxLength: 16 },
          { key: "invoiceDate", label: "Invoice date", kind: "date", noFuture: true },
          { key: "totalPackages", label: "Total packages", kind: "integer" },
          { key: "grossWeight", label: "Total gross weight", kind: "number" },
          { key: "netWeight", label: "Total net weight", kind: "number" },
          { key: "weightUnit", label: "Unit", kind: "select", options: KG_T, defaultValue: "KGS" },
        ],
      },
      containerRows(0, 50, "If the packing list names the container(s)."),
    ],
  },
};

/** Blank values for a form, with each field's default. Repeated sections start with their minimum rows (at least one when required). */
export function blankValues(spec: FormSpec): { values: Record<string, string>; rows: Record<string, Array<Record<string, string>>> } {
  const values: Record<string, string> = {};
  const rows: Record<string, Array<Record<string, string>>> = {};
  for (const s of spec.sections) {
    if (s.kind === "group") for (const f of s.fields) values[f.key] = f.defaultValue ?? "";
    else rows[s.key] = Array.from({ length: s.min }, () => blankRow(s));
  }
  return { values, rows };
}

export function blankRow(s: RepeatSpec): Record<string, string> {
  return Object.fromEntries(s.fields.map((f) => [f.key, f.defaultValue ?? ""]));
}

const str = (v: unknown) => (v == null ? "" : String(v));

/** Fills a blank form from earlier values (a corrected document's saved form, or what was read from a photo). */
export function fillValues(spec: FormSpec, initial: Record<string, unknown> | null | undefined) {
  const out = blankValues(spec);
  if (!initial) return out;
  for (const s of spec.sections) {
    if (s.kind === "group") {
      for (const f of s.fields) if (initial[f.key] != null && initial[f.key] !== "") out.values[f.key] = str(initial[f.key]);
    } else {
      const list = initial[s.key];
      if (Array.isArray(list) && list.length) {
        out.rows[s.key] = list.slice(0, s.max).map((r) => {
          const row = blankRow(s);
          if (r && typeof r === "object") for (const f of s.fields) if ((r as Record<string, unknown>)[f.key] != null) row[f.key] = str((r as Record<string, unknown>)[f.key]);
          return row;
        });
      }
    }
  }
  return out;
}
