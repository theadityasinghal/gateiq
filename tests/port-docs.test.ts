import { describe, expect, it } from "vitest";
import { eSealSchema, form13Schema, packingListSchema, shippingBillSchema, vgmSchema } from "@/lib/case-schema";
import { normalizeESeal, normalizeForm13, normalizeVgm } from "@/lib/normalize/port-docs";
import { normalizePackingList } from "@/lib/normalize/commercial-docs";
import { blankValues, DOC_FORMS, fillValues } from "@/lib/doc-forms";

describe("Form-13", () => {
  const base = {
    bookingNo: "bom 1234567",
    containerNo: "msku 999801 0", // check digit wrong, but it is what the paper says
    isoCode: "22g1",
    lineSealNo: "ml-123456",
    eSealNo: "",
    vgm: "24.5",
    vgmUnit: "MTS",
    sbNumber: "",
    chaLicence: "",
    shipperName: "Acme Polymers Private Limited",
    pod: "aejea",
    vesselCall: "",
    vehicleNumber: "mh 04 ab 1234",
    issuedOn: "",
  };

  it("keeps a container number whose check digit fails, and normalises the rest", () => {
    const parsed = form13Schema.parse(base);
    expect(parsed.containerNo).toBe("MSKU9998010");
    expect(parsed.eSealNo).toBeNull();
    const { normalized } = normalizeForm13(parsed);
    expect(normalized.container).toEqual({ number: "MSKU9998010", isoCode: "22G1", lineSeal: "ML123456", eSeal: null });
    expect(normalized.vgmT).toBe(24.5);
    expect(normalized.shipperName).toBe("ACME POLYMERS PVT LTD");
    expect(normalized.vehicleNumber).toBe("MH04AB1234");
    expect(normalized.documentDate).toBeNull();
  });

  it("rejects a container number of the wrong shape", () => {
    const r = form13Schema.safeParse({ ...base, containerNo: "MSK1234" });
    expect(r.success).toBe(false);
  });
});

describe("VGM declaration", () => {
  it("converts kg to tonnes per container and keeps a missing tare as null", () => {
    const parsed = vgmSchema.parse({
      bookingNo: "BOM1234567",
      shipperName: "Acme",
      shipperIec: "",
      method: "1",
      weighingSlipNo: "ws-77",
      weighbridgeRegNo: "",
      weighedOn: "2026-11-01",
      containers: [
        { containerNo: "CSQU3054383", vgmKg: "24500", tareKg: "2200" },
        { containerNo: "CSQU3054383", vgmKg: "18000", tareKg: "" },
      ],
    });
    const { normalized } = normalizeVgm(parsed);
    expect(normalized.documentNumber).toBe("WS-77");
    expect(normalized.containers).toEqual([
      { number: "CSQU3054383", vgmT: 24.5, tareT: 2.2 },
      { number: "CSQU3054383", vgmT: 18, tareT: null },
    ]);
  });
});

describe("e-seal record", () => {
  it("normalises IDs and requires the shipping bill", () => {
    const ok = eSealSchema.parse({
      eSealNo: "ABCD 1234 5678",
      containerNo: "CSQU3054383",
      sbNumber: "1234567",
      sbDate: "2026-11-01",
      iec: "abcde1234f",
      truckNumber: "",
      sealedOn: "2026-11-02",
    });
    const { normalized } = normalizeESeal(ok);
    expect(normalized.eSealNo).toBe("ABCD12345678");
    expect(normalized.iec).toBe("ABCDE1234F");
    expect(normalized.truckNumber).toBeNull();
    expect(eSealSchema.safeParse({ ...ok, sbNumber: "" }).success).toBe(false);
  });
});

describe("packing list", () => {
  it("converts weights and lists containers", () => {
    const parsed = packingListSchema.parse({
      invoiceNumber: "inv/26/001",
      invoiceDate: "",
      totalPackages: "40",
      grossWeight: "12500",
      netWeight: "",
      weightUnit: "KGS",
      containers: [{ containerNo: "CSQU 305438 3" }],
    });
    const { normalized } = normalizePackingList(parsed);
    expect(normalized.documentNumber).toBe("INV/26/001");
    expect(normalized.totals).toEqual({ packages: 40, grossWeightT: 12.5, netWeightT: null });
    expect(normalized.containerNumbers).toEqual(["CSQU3054383"]);
  });
});

describe("shipping bill containers", () => {
  it("defaults to no containers for older payloads", () => {
    const r = shippingBillSchema.safeParse({
      sbNumber: "1234567",
      sbDate: "2026-11-01",
      portCode: "INNSA1",
      exporterIec: "ABCDE1234F",
      consigneeName: "Buyer LLC",
      currency: "USD",
      totalPackages: 40,
      grossWeight: 12500,
      netWeight: 12000,
      weightUnit: "KGS",
      lines: [{ description: "Granules", hsCode: "39011010", quantity: 12000, uqc: "KGS", value: 15000 }],
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.containers).toEqual([]);
  });
});

describe("form specs", () => {
  it("starts required repeats with one row and fills saved values as strings", () => {
    const spec = DOC_FORMS.vgm_declaration!;
    expect(blankValues(spec).rows.containers).toHaveLength(1);
    const filled = fillValues(spec, { bookingNo: "B1", containers: [{ containerNo: "CSQU3054383", vgmKg: 24500, tareKg: null }] });
    expect(filled.values.bookingNo).toBe("B1");
    expect(filled.values.method).toBe("1");
    expect(filled.rows.containers[0]).toEqual({ containerNo: "CSQU3054383", vgmKg: "24500", tareKg: "" });
  });
});
