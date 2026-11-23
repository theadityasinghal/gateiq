import { describe, expect, it } from "vitest";
import { getPath, readEdits, tidyDiffs } from "@/lib/raw-vs-tidy";

describe("typed vs compared", () => {
  const form = { invoiceNumber: "inv/26/001", grossWeight: 12500, lines: [{ hsCode: "3901.10" }], invoiceDate: "2026-10-30" };
  const normalized = { documentNumber: "INV/26/001", totals: { grossWeightT: 12.5 }, lines: [{ hsCode: "39011000" }], documentDate: "2026-10-30" };
  const provenance = {
    documentNumber: "input.invoiceNumber (uppercased)",
    "totals.grossWeightT": "input.grossWeight (KGS → t)",
    "lines[0].hsCode": "input.lines[0].hsCode (8-digit)",
    documentDate: "input.invoiceDate (converted to ISO)",
    "totals.value": "sum of input.lines[].value",
  };

  it("lists only fields whose typed value differs from what is compared, with why", () => {
    const d = tidyDiffs(form, normalized, provenance);
    expect(d.map((x) => x.field)).toEqual(["documentNumber", "totals.grossWeightT", "lines[0].hsCode"]);
    expect(d[1]).toEqual({ field: "totals.grossWeightT", typed: "12500", compared: "12.5", how: "KGS → t" });
  });

  it("reads nested paths both ways", () => {
    expect(getPath({ a: [{ b: 1 }] }, "a[0].b")).toBe(1);
    expect(getPath({ a: [{ b: 1 }] }, "a.0.b")).toBe(1);
    expect(getPath(null, "a")).toBeUndefined();
  });

  it("is empty without a form", () => {
    expect(tidyDiffs(null, normalized, provenance)).toEqual([]);
  });
});

describe("changed after reading", () => {
  it("reads the lists the save recorded, and tolerates their absence", () => {
    expect(readEdits({ corrected: ["invoiceNumber"], typed: null })).toEqual({ corrected: ["invoiceNumber"], typed: [] });
    expect(readEdits(null)).toEqual({ corrected: [], typed: [] });
  });
});
