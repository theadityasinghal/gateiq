/**
 * The JSON schema the vision model fills in for one document type, built from that type's form spec so
 * that what comes back always lines up with the form the adder confirms. Every field is
 * { value, confidence }: the value exactly as printed, and how sure the model is of the characters.
 */
import { DOC_TYPES, type DocType } from "@/lib/documents";
import { DOC_FORMS, type FieldSpec } from "@/lib/doc-forms";

export const EXTRACTION_PROMPT_VERSION = "v1";

const SOURCE_HINT: Record<string, string> = {
  currencies: "ISO 4217 currency code, e.g. USD, EUR, INR.",
  uqc: "Unit as a GST UQC code, e.g. KGS, NOS, MTR, PCS, BAG.",
  massUnits: "Weight unit as KGS or MTS (tonnes).",
  phoneCountries: "Two-letter country of the phone number, e.g. IN.",
};

function describe(f: FieldSpec): string {
  const parts = [f.label + "."];
  if (f.hint) parts.push(f.hint);
  switch (f.kind) {
    case "date":
      parts.push("As YYYY-MM-DD.");
      break;
    case "number":
    case "integer":
      parts.push("Digits only, no thousands separators or units, in the unit printed on the document.");
      break;
    case "container":
      parts.push("Container number exactly as printed: 4 letters and 7 digits. Copy it even if it looks wrong; never fix it.");
      break;
    case "code":
      parts.push("Copy the characters exactly; spaces and hyphens may be dropped.");
      break;
    case "select":
      if (typeof f.options === "string") parts.push(SOURCE_HINT[f.options] ?? "");
      else if (f.options) parts.push(`One of: ${f.options.map((o) => `${o.value} (${o.label})`).join(", ")}.`);
      break;
  }
  return parts.join(" ").trim();
}

function cell(f: FieldSpec) {
  return {
    type: "object",
    description: describe(f),
    properties: {
      value: { type: ["string", "null"], description: "Null when the field is not on the document or can't be read." },
      confidence: { type: "number", minimum: 0, maximum: 1, description: "0 to 1: how sure you are every character is read correctly." },
    },
    required: ["value", "confidence"],
  };
}

export function extractionSchema(type: DocType) {
  const spec = DOC_FORMS[type];
  if (!spec) throw new Error(`No form for ${type}`);
  const fields: Record<string, unknown> = {};
  for (const s of spec.sections) {
    if (s.kind === "group") {
      for (const f of s.fields) fields[f.key] = cell(f);
    } else {
      fields[s.key] = {
        type: "array",
        // No maxItems: Gemini rejects large limits. Rows beyond the form's maximum are dropped afterwards.
        description: `${s.title}: one entry per ${s.itemLabel.toLowerCase()} on the document, in order.`,
        items: {
          type: "object",
          properties: Object.fromEntries(s.fields.map((f) => [f.key, cell(f)])),
          required: s.fields.map((f) => f.key),
        },
      };
    }
  }
  return {
    type: "object",
    properties: {
      documentLooksLike: { type: "string", description: "In a few words, what kind of document this is." },
      isExpectedType: { type: "boolean", description: `True if this is a ${DOC_TYPES[type].label}.` },
      fields: { type: "object", properties: fields, required: Object.keys(fields) },
    },
    required: ["documentLooksLike", "isExpectedType", "fields"],
  };
}

export function extractionPrompt(type: DocType): string {
  const label = DOC_TYPES[type].label;
  return [
    `You are reading one ${label} from an Indian export consignment (a photo or a PDF). ${DOC_TYPES[type].blurb}`,
    "Fill in the fields of the JSON schema from this document only.",
    "Rules:",
    "- Copy every value exactly as printed. Do not correct, complete or reformat identifiers (container numbers, seal numbers, GSTINs, invoice numbers); a mistake on the paper must be copied as it is.",
    "- Dates as YYYY-MM-DD. Numbers as plain digits in the unit printed.",
    "- If a field isn't on the document, or you can't read it, give value null and confidence 0. Never guess or work a value out from other fields.",
    "- Confidence is how sure you are that each character is right: lower it for handwriting, stamps over text, blur or ambiguous characters (0/O, 1/I, 5/S, 8/B).",
    "- For repeated rows (item lines, containers), give one entry per row printed, in order.",
  ].join("\n");
}
