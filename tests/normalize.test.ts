import { describe, expect, it } from "vitest";
import {
  normalizeHsCode,
  normalizePartyName,
  normalizeShippingBill,
  toIsoDate,
  toTonnes,
} from "@/lib/normalize/shipping-bill";

// Mass-unit factors as the UQC master provides them (test input, not app data).
const factors = { KGS: 0.001, MTS: 1, TON: 1, QTL: 0.1, GMS: 0.000001, NOS: null };

describe("normaliser", () => {
  it("converts mass units to tonnes and rejects non-mass units", () => {
    expect(toTonnes(12500, "kgs", factors)).toBe(12.5);
    expect(toTonnes(3, "QTL", factors)).toBe(0.3);
    expect(() => toTonnes(1, "NOS", factors)).toThrow();
  });
  it("reads ISO and Indian day-first dates, and rejects impossible ones", () => {
    expect(toIsoDate("2026-11-03")).toBe("2026-11-03");
    expect(toIsoDate("3/11/2026")).toBe("2026-11-03");
    expect(toIsoDate("03-11-2026")).toBe("2026-11-03");
    expect(() => toIsoDate("31/02/2026")).toThrow();
  });
  it("normalises HS codes without guessing", () => {
    expect(normalizeHsCode("0901.11.10")).toBe("09011110");
    expect(normalizeHsCode("9011110")).toBe("09011110");
    expect(() => normalizeHsCode("8471")).toThrow();
  });
  it("standardises party names", () => {
    expect(normalizePartyName("  Acme  Traders Private Limited. ")).toBe("ACME TRADERS PVT LTD");
    expect(normalizePartyName("ACME TRADERS PVT. LTD.")).toBe("ACME TRADERS PVT LTD");
  });
});
