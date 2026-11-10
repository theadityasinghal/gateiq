import { describe, expect, it } from "vitest";
import {
  containerCheckDigit,
  describeSizeType,
  formatContainerNo,
  isValidContainerNo,
  normalizeContainerNo,
  suggestContainerNo,
} from "@/lib/iso6346";

describe("ISO 6346 container numbers", () => {
  it("computes the check digit from the BIC example", () => {
    expect(containerCheckDigit("CSQU305438")).toBe(3);
    expect(isValidContainerNo("CSQU3054383")).toBe(true);
  });

  it("maps a remainder of 10 to 0", () => {
    // Find a prefix whose sum mod 11 is 10 and check it lands on 0.
    let found = false;
    for (let n = 0; n < 2000 && !found; n++) {
      const prefix = `ABCU${String(n).padStart(6, "0")}`;
      let sum = 0;
      const vals = [10, 12, 13, 32];
      for (let i = 0; i < 10; i++) sum += (i < 4 ? vals[i] : Number(prefix[i])) * 2 ** i;
      if (sum % 11 === 10) {
        expect(containerCheckDigit(prefix)).toBe(0);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("tolerates spaces and lower case", () => {
    expect(normalizeContainerNo(" csqu 305438-3 ")).toBe("CSQU3054383");
    expect(isValidContainerNo("csqu 305438 3")).toBe(true);
    expect(formatContainerNo("csqu3054383")).toBe("CSQU 305438 3");
  });

  it("rejects a terminal manual's sample number and suggests the fix", () => {
    expect(isValidContainerNo("MSKU9998010")).toBe(false);
    expect(suggestContainerNo("MSKU9998010")[0]).toBe("MSKU9998019");
  });

  it("finds a single wrong serial digit or a swap", () => {
    const sugg = suggestContainerNo("CSQU3045383"); // 5 and 4 swapped
    expect(sugg).toContain("CSQU3054383");
    expect(suggestContainerNo("CSQU3054383")).toEqual([]); // already valid
    expect(suggestContainerNo("not a number")).toEqual([]);
  });

  it("describes size and type codes, new and legacy", () => {
    expect(describeSizeType("22G1")).toEqual({ lengthFt: 20, highCube: false, kind: "general" });
    expect(describeSizeType("45R1")).toEqual({ lengthFt: 40, highCube: true, kind: "reefer" });
    expect(describeSizeType("L5G1")?.lengthFt).toBe(45);
    expect(describeSizeType("2210")).toEqual({ lengthFt: 20, highCube: false, kind: null });
    expect(describeSizeType("XX")).toBeNull();
  });
});
