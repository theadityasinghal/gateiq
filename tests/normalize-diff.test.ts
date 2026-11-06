import { describe, expect, it } from "vitest";
import {
  normalizeHsCode,
  normalizePartyName,
  normalizeShippingBill,
  toIsoDate,
  toTonnes,
  type ShippingBillInput,
} from "@/lib/normalize/shipping-bill";
import { diffDeclaredVsFiled, type DeclaredCase } from "@/lib/diff";

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

describe("declared vs filed diff", () => {
  const filedInput: ShippingBillInput = {
    sbNumber: " 1234567 ",
    sbDate: "03/11/2026",
    portCode: "innsa1",
    exporterIec: "aapfu0939f",
    exporterGstin: "27aapfu0939f1zv",
    consigneeName: "Acme Traders Private Limited",
    currency: "usd",
    totalPackages: 40,
    grossWeight: 10.2,
    netWeight: 9.8,
    weightUnit: "MTS",
    lines: [{ description: "Coffee beans", hsCode: "09011110", quantity: 9800, uqc: "kgs", value: 52000 }],
  };
  const declared: DeclaredCase = {
    consigneeName: "ACME TRADERS PVT. LTD.",
    exportPortCode: "INNSA1",
    currency: "USD",
    lines: [
      {
        hsCode: "09011110",
        description: "Coffee beans",
        quantity: 9800,
        uqc: "KGS",
        netWeight: 9800,
        grossWeight: 10200,
        weightUnit: "KGS",
        packages: 40,
        value: 52000,
      },
    ],
  };

  it("finds no differences when declared and filed agree (across units)", () => {
    const { normalized } = normalizeShippingBill(filedInput, factors);
    const rows = diffDeclaredVsFiled(declared, normalized, factors);
    expect(rows.filter((r) => r.status !== "match")).toEqual([]);
  });

  it("flags a deliberate weight mismatch", () => {
    const { normalized } = normalizeShippingBill({ ...filedInput, grossWeight: 11.4 }, factors);
    const rows = diffDeclaredVsFiled(declared, normalized, factors);
    const gross = rows.find((r) => r.key === "grossWeight")!;
    expect(gross.status).toBe("mismatch");
    expect(gross.declared).toBe("10.200 t");
    expect(gross.filed).toBe("11.400 t");
  });

  it("flags HS codes present on only one side and refuses cross-currency value comparison", () => {
    const { normalized } = normalizeShippingBill(
      { ...filedInput, currency: "EUR", lines: [{ ...filedInput.lines[0], hsCode: "09011190" }] },
      factors,
    );
    const rows = diffDeclaredVsFiled(declared, normalized, factors);
    expect(rows.find((r) => r.key === "hs:09011110")?.status).toBe("only_declared");
    expect(rows.find((r) => r.key === "hs:09011190")?.status).toBe("only_filed");
    expect(rows.find((r) => r.key === "value")?.status).toBe("not_comparable");
  });
});
