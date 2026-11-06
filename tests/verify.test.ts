import { describe, expect, it } from "vitest";
import { gstinCheckChar, verifyDrivingLicence, verifyEmail, verifyGstin, verifyIec, verifyPhone } from "@/lib/verify/identifiers";

describe("GSTIN", () => {
  it("matches the check digit of the widely published GSTN example", () => {
    expect(gstinCheckChar("27AAPFU0939F1Z")).toBe("V");
  });
  it("accepts a well-formed GSTIN with the right check digit", () => {
    const r = verifyGstin("27aapfu0939f1zv");
    expect(r.level).toBe("format_valid");
    expect(r.evidence.pan).toBe("AAPFU0939F");
    expect(r.evidence.stateName).toBe("Maharashtra");
  });
  it("rejects a wrong check digit (typo)", () => {
    const r = verifyGstin("27AAPFU0939F1ZW");
    expect(r.level).toBe("invalid");
    expect(r.message).toMatch(/check digit/i);
  });
  it("rejects an unknown state code", () => {
    const body = "45AAPFU0939F1Z";
    expect(verifyGstin(body + gstinCheckChar(body)).level).toBe("invalid");
  });
  it("rejects garbage", () => {
    expect(verifyGstin("hello").level).toBe("invalid");
  });
});

describe("IEC", () => {
  it("is format-valid when it equals the PAN inside the GSTIN", () => {
    const r = verifyIec("AAPFU0939F", "27AAPFU0939F1ZV");
    expect(r.level).toBe("format_valid");
    expect(r.evidence.crossCheckedWithGstin).toBe(true);
  });
  it("is flagged when it does not match the GSTIN's PAN", () => {
    const r = verifyIec("AAPFU0939G", "27AAPFU0939F1ZV");
    expect(r.level).toBe("invalid");
    expect(r.evidence.gstinPan).toBe("AAPFU0939F");
  });
  it("accepts legacy numeric IECs without a cross-check", () => {
    expect(verifyIec("0123456789", "27AAPFU0939F1ZV").evidence.legacy).toBe(true);
  });
  it("rejects malformed values", () => {
    expect(verifyIec("ABC").level).toBe("invalid");
  });
});

describe("phone, licence, email", () => {
  it("normalises Indian mobile numbers", () => {
    expect(verifyPhone("+91 98765 43210").value).toBe("+919876543210");
    expect(verifyPhone("12345").level).toBe("invalid");
  });
  it("recognises the national DL format but never blocks other formats", () => {
    expect(verifyDrivingLicence("MH14 20110062821").level).toBe("format_valid");
    expect(verifyDrivingLicence("OLD/123/99").level).toBe("self_declared");
  });
  it("treats an unverified email as self-declared and flags non-government domains for officials", () => {
    const r = verifyEmail("someone@example.com", false, true);
    expect(r.level).toBe("self_declared");
    expect(r.message).toMatch(/Not a government email domain/);
    expect(verifyEmail("officer@cbic.gov.in", false, true).evidence.governmentDomain).toBe(true);
    expect(verifyEmail("someone@example.com", true, false).level).toBe("owned");
  });
});

import { parseCsv } from "../scripts/import-masters/csv";
describe("master CSV parser", () => {
  it("handles quotes, commas and CRLF", () => {
    const rows = parseCsv('﻿Code,Description\r\n09011110,"Coffee, not roasted ""A"""\r\n\r\n');
    expect(rows).toEqual([{ code: "09011110", description: 'Coffee, not roasted "A"' }]);
  });
});
