import { describe, expect, it } from "vitest";
import { applyDocRules } from "@/lib/doc-rules";
import { expectedDocuments, missingDocuments } from "@/lib/documents";

const keys = (c: Parameters<typeof applyDocRules>[0]) => applyDocRules(c).map((n) => n.key);
const BASIC = ["shipping_bill", "commercial_invoice", "packing_list", "eway_bill", "lorry_receipt"];

describe("required-documents rules", () => {
  it("asks every case for the basic shipping papers, each with a reason", () => {
    const needs = applyDocRules({ incoterm: "FOB", hsCodes: ["39011010"] });
    expect(needs.map((n) => n.key)).toEqual(BASIC);
    for (const n of needs) expect(n.reason.length).toBeGreaterThan(10);
  });

  it("asks for insurance only when the seller insures (CIF, CIP)", () => {
    expect(keys({ incoterm: "CIF" })).toContain("insurance_certificate");
    expect(keys({ incoterm: "CIP" })).toContain("insurance_certificate");
    expect(keys({ incoterm: "FOB" })).not.toContain("insurance_certificate");
  });

  it("asks for a health certificate for animal products and a phytosanitary one for plant products", () => {
    expect(keys({ hsCodes: ["03061790"] })).toContain("health_certificate"); // frozen shrimp
    expect(keys({ hsCodes: ["16041400"] })).toContain("health_certificate"); // prepared tuna
    expect(keys({ hsCodes: ["09041110"] })).toContain("phytosanitary_certificate"); // pepper
    expect(keys({ hsCodes: ["39011010"] })).not.toContain("phytosanitary_certificate");
  });

  it("asks for the exact certificate a perishable case picked, without asking twice", () => {
    const needs = applyDocRules({ perishable: { certificateType: "Phytosanitary certificate" }, hsCodes: ["08045020"] });
    expect(needs.filter((n) => n.anyOf.includes("phytosanitary_certificate"))).toHaveLength(1);
    const coo = applyDocRules({ perishable: { certificateType: "Certificate of origin" } }).find((n) => n.key === "perishable_certificate");
    expect(coo?.anyOf).toEqual(["certificate_of_origin"]);
  });

  it("reads HS codes from the case's goods lines", () => {
    const needs = expectedDocuments({ incoterm: "FOB", lines: [{ hsCode: "03061790" }] });
    expect(missingDocuments(needs, BASIC as never).map((n) => n.key)).toEqual(["health_certificate"]);
  });
});
