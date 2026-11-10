import { describe, expect, it } from "vitest";
import { extractionSchema } from "@/lib/extract/schema";
import { changedFields, checkValue, offerFromReading } from "@/lib/extract/postprocess";
import { parseQr } from "@/lib/qr/parse";
import { DOC_FORMS } from "@/lib/doc-forms";

const today = "2026-11-09";
const cell = (value: string | null, confidence = 0.95) => ({ value, confidence });

describe("extraction schema", () => {
  it("has a field for every form field and arrays for repeated rows", () => {
    const s = extractionSchema("shipping_bill") as { properties: { fields: { properties: Record<string, { type: string; items?: { properties: Record<string, unknown> } }> } } };
    const f = s.properties.fields.properties;
    expect(Object.keys(f)).toEqual(expect.arrayContaining(["sbNumber", "sbDate", "lines", "containers"]));
    expect(f.lines.type).toBe("array");
    expect(Object.keys(f.containers.items!.properties)).toEqual(["containerNo", "sizeType", "sealNo"]);
  });
});

describe("offerFromReading", () => {
  it("cleans values, flags failing check digits and GSTINs, and keeps rows", () => {
    const out = {
      documentLooksLike: "Form-13",
      isExpectedType: true,
      fields: {
        containerNo: cell("CSQU 304538 3", 0.97), // swapped digits: check digit fails
        isoCode: cell("22G1"),
        bookingNo: cell("BOM1234567"),
        lineSealNo: cell(null, 0),
        eSealNo: cell("ABCD 1234 5678"),
        vgm: cell("24,500"),
        vgmUnit: cell("KGS"),
        sbNumber: cell("1234567"),
        chaLicence: cell(null, 0),
        shipperName: cell("Acme Polymers", 0.6),
        pod: cell("AEJEA"),
        vesselCall: cell(null, 0),
        vehicleNumber: cell("MH-04-AB-1234"),
        issuedOn: cell("02/11/2026"),
      },
    };
    const o = offerFromReading("form_13", out, null, today);
    expect(o.initial.containerNo).toBe("CSQU3045383");
    expect(o.meta.containerNo.problem).toMatch(/Check digit fails/);
    expect(o.meta.containerNo.confidence).toBeLessThan(0.8);
    expect(o.initial.vgm).toBe("24500");
    expect(o.initial.vehicleNumber).toBe("MH04AB1234");
    expect(o.initial.issuedOn).toBe("2026-11-02");
    expect(o.initial.lineSealNo).toBeUndefined();
    expect(o.meta.shipperName.confidence).toBe(0.6);
    expect(o.warning).toBeNull();
  });

  it("lets QR values win and warns about the wrong document", () => {
    const qr = parseQr("321008765432/27ABCDE1234F1Z5/05/11/2026 10:15:00 AM");
    const o = offerFromReading("eway_bill", { isExpectedType: false, documentLooksLike: "a delivery challan", fields: { ewbNumber: cell("321008765482", 0.5) } }, qr, today);
    expect(o.initial.ewbNumber).toBe("321008765432");
    expect(o.meta.ewbNumber).toEqual({ source: "qr" });
    expect(o.warning).toMatch(/delivery challan/);
  });

  it("survives junk from the model", () => {
    const o = offerFromReading("vgm_declaration", "not json", null, today);
    expect(o.initial).toEqual({});
    expect(offerFromReading("vgm_declaration", { fields: { containers: [{ containerNo: cell("CSQU3054383"), vgmKg: cell("24500"), tareKg: cell(null, 0) }] } }, null, today).initial.containers).toEqual([
      { containerNo: "CSQU3054383", vgmKg: "24500" },
    ]);
  });
});

describe("checkValue", () => {
  const field = (key: string) => DOC_FORMS.eway_bill!.sections.flatMap((s) => s.fields).find((f) => f.key === key)!;
  it("checks a GSTIN's check character", () => {
    expect(checkValue(field("fromGstin"), "27AAPFU0939F1ZV", today).problem).toBeNull();
    expect(checkValue(field("fromGstin"), "27AAPFU0939F1ZX", today).problem).toMatch(/check character/);
    expect(checkValue(field("toGstin"), "urp", today)).toEqual({ value: "URP", problem: null });
  });
  it("rejects future dates where the form does", () => {
    expect(checkValue(field("ewbDate"), "2027-01-01", today).problem).toMatch(/future/);
  });
});

describe("changedFields", () => {
  it("ignores formatting and reports edits and hand-typed fields", () => {
    const offered = { containerNo: "CSQU3045383", vgm: "24500", lines: [{ hsCode: "39011010" }] };
    const confirmed = { containerNo: "CSQU3054383", vgm: 24500, lines: [{ hsCode: "3901 1010", quantity: 10 }], pod: "AEJEA" };
    expect(changedFields(offered, confirmed)).toEqual({ corrected: ["containerNo"], typed: ["lines.0.quantity", "pod"] });
  });
});
