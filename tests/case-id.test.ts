import { describe, expect, it } from "vitest";
import { generateCaseCode, isValidCaseCode, normalizeCaseCode } from "@/lib/case-id";

describe("case code", () => {
  it("has the GIQ-YY-XXXXXXXX shape and validates", () => {
    const code = generateCaseCode(new Date("2026-11-05T00:00:00Z"));
    expect(code).toMatch(/^GIQ-26-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(isValidCaseCode(code)).toBe(true);
  });

  it("is unique across many draws", () => {
    const codes = new Set(Array.from({ length: 20000 }, () => generateCaseCode()));
    expect(codes.size).toBe(20000);
  });

  it("catches every single-character substitution", () => {
    const code = generateCaseCode();
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const body = code.slice(7);
    for (let i = 0; i < body.length; i++) {
      for (const ch of alphabet) {
        if (ch === body[i]) continue;
        const typo = code.slice(0, 7) + body.slice(0, i) + ch + body.slice(i + 1);
        expect(isValidCaseCode(typo)).toBe(false);
      }
    }
  });

  // Luhn mod N's one known blind spot: swapping the first and last alphabet symbols ("0" ↔ "Z").
  it("catches adjacent swaps, except Luhn's 0↔Z blind spot", () => {
    for (let n = 0; n < 200; n++) {
      const code = generateCaseCode();
      const body = code.slice(7);
      for (let i = 0; i < body.length - 1; i++) {
        if (body[i] === body[i + 1]) continue;
        const pair = body[i] + body[i + 1];
        if (pair === "0Z" || pair === "Z0") continue;
        const swapped = code.slice(0, 7) + body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2);
        expect(isValidCaseCode(swapped)).toBe(false);
      }
    }
  });

  it("forgives lowercase, missing dashes and I/L/O look-alikes", () => {
    const code = generateCaseCode();
    expect(isValidCaseCode(code.toLowerCase().replace(/-/g, " "))).toBe(true);
    const withO = code.replace(/0/g, "O");
    expect(normalizeCaseCode(withO)).toBe(code);
  });
});
