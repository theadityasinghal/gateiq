import { describe, expect, it } from "vitest";
import { normalizeLorryReceipt } from "@/lib/normalize/lorry-receipt";
import { lorryReceiptSchema } from "@/lib/case-schema";

const base = {
  lrNumber: "lr 2024 0012",
  lrDate: "05/11/2026",
  vehicleNumber: "mh 04-ab 1234",
  driverName: "  Ramesh   Kumar ",
  driverPhone: "+919812345678",
  fromPlace: "Bhiwandi ",
  toPlace: " JNPT",
  packages: 40,
  goodsDescription: "Plastic   granules",
  chargedWeight: 12500,
  weightUnit: "KGS" as const,
};

describe("normalizeLorryReceipt", () => {
  it("cleans numbers, dates, names and converts weight to tonnes", () => {
    const { normalized, provenance } = normalizeLorryReceipt(base);
    expect(normalized.documentNumber).toBe("LR20240012");
    expect(normalized.documentDate).toBe("2026-11-05");
    expect(normalized.vehicleNumber).toBe("MH04AB1234");
    expect(normalized.driver).toEqual({ name: "Ramesh Kumar", phone: "+919812345678" });
    expect(normalized.route).toEqual({ from: "Bhiwandi", to: "JNPT" });
    expect(normalized.goodsDescription).toBe("Plastic granules");
    expect(normalized.chargedWeightT).toBe(12.5);
    expect(provenance.chargedWeightT).toContain("KGS");
  });

  it("keeps tonnes as they are and allows an unknown driver", () => {
    const { normalized } = normalizeLorryReceipt({ ...base, weightUnit: "MTS", chargedWeight: 12.5, driverName: null, driverPhone: null });
    expect(normalized.chargedWeightT).toBe(12.5);
    expect(normalized.driver).toEqual({ name: null, phone: null });
  });
});

describe("lorryReceiptSchema", () => {
  const form = {
    lrNumber: "LR1",
    lrDate: "2026-11-01",
    vehicleNumber: "MH 04 AB 1234",
    driverName: "",
    driverPhone: "",
    driverPhoneCountry: "IN",
    fromPlace: "Pune",
    toPlace: "Nhava Sheva",
    packages: "10",
    goodsDescription: "Granules",
    chargedWeight: "1000",
    weightUnit: "KGS",
  };

  it("accepts a valid LR and blanks optional driver fields", () => {
    const r = lorryReceiptSchema.safeParse(form);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.vehicleNumber).toBe("MH04AB1234");
      expect(r.data.driverName).toBeNull();
      expect(r.data.driverPhone).toBeNull();
    }
  });

  it("rejects a bad vehicle number and a future date", () => {
    const r = lorryReceiptSchema.safeParse({ ...form, vehicleNumber: "XYZ", lrDate: "2999-01-01" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("vehicleNumber");
    }
  });
});
