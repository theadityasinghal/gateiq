import { describe, expect, it } from "vitest";
import { DOC_TYPE_KEYS, DOC_TYPES, addableTypes, canAddDocument, docTypeFromSlug, docTypeSlug, isDocType, type DocType } from "@/lib/documents";
import { ROLES, ROLE_INFO, type Role } from "@/lib/roles";

/** The agreed matrix: who may add which document. */
const EXPECTED: Partial<Record<Role, DocType[]>> = {
  consignor: [
    "shipping_bill",
    "eway_bill",
    "commercial_invoice",
    "packing_list",
    "msds",
    "temperature_spec",
    "quality_certificate",
    "fumigation_certificate",
  ],
  cha: ["shipping_bill", "commercial_invoice", "packing_list"],
  transporter: ["eway_bill", "lorry_receipt"],
  consignee: ["eway_bill"],
};

describe("who can add which document", () => {
  it("matches the agreed matrix for every role and type", () => {
    for (const role of ROLES) {
      for (const type of DOC_TYPE_KEYS) {
        expect(canAddDocument(role, type), `${role} → ${type}`).toBe((EXPECTED[role] ?? []).includes(type));
      }
    }
  });

  it("lists addable types in a stable order", () => {
    expect(addableTypes("transporter")).toEqual(["eway_bill", "lorry_receipt"]);
    expect(addableTypes("cha")).toEqual(["shipping_bill", "commercial_invoice", "packing_list"]);
  });

  it("lets drivers and officials add nothing yet", () => {
    expect(addableTypes("driver")).toEqual([]);
    for (const role of ROLES) if (ROLE_INFO[role].official) expect(addableTypes(role)).toEqual([]);
  });

  it("gives every type at least one issuer", () => {
    for (const type of DOC_TYPE_KEYS) expect(DOC_TYPES[type].issuers.length).toBeGreaterThan(0);
  });
});

describe("document type keys", () => {
  it("round-trips through URL slugs", () => {
    for (const type of DOC_TYPE_KEYS) expect(docTypeFromSlug(docTypeSlug(type))).toBe(type);
    expect(docTypeSlug("lorry_receipt")).toBe("lorry-receipt");
  });

  it("rejects unknown types", () => {
    expect(isDocType("bill_of_lading")).toBe(false);
    expect(docTypeFromSlug("nope")).toBeNull();
    expect(isDocType(42)).toBe(false);
  });
});
