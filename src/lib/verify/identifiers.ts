import { GST_STATE_CODES } from "./gst-state-codes";
import type { VerificationResult } from "./types";

const GSTIN_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_RE = /^[0-9]{2}[A-Z]{3}[ABCFGHLJPTK][A-Z][0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{3}[ABCFGHLJPTK][A-Z][0-9]{4}[A-Z]$/;
const LEGACY_IEC_RE = /^[0-9]{10}$/;
const PHONE_RE = /^(?:\+91|91|0)?([6-9][0-9]{9})$/;
const DL_RE = /^([A-Z]{2})([0-9]{2})((?:19|20)[0-9]{2})([0-9]{7})$/;

const PAN_HOLDER_TYPES: Record<string, string> = {
  A: "Association of Persons",
  B: "Body of Individuals",
  C: "Company",
  F: "Firm / LLP",
  G: "Government",
  H: "Hindu Undivided Family",
  J: "Artificial Juridical Person",
  K: "Krishi (Agricultural)",
  L: "Local Authority",
  P: "Individual",
  T: "Trust",
};

export function clean(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/** GSTN check-digit algorithm (mod 36 over the first 14 characters). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const code = GSTIN_CHARSET.indexOf(first14[i]);
    if (code < 0) throw new Error(`Invalid GSTIN character: ${first14[i]}`);
    const product = code * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARSET[(36 - (sum % 36)) % 36];
}

export function verifyGstin(raw: string, field = "gstin"): VerificationResult {
  const value = clean(raw);
  const base = { field, value, verifier: "gstin-format@1" };
  if (!GSTIN_RE.test(value)) {
    return {
      ...base,
      level: "invalid",
      message: "Not a valid GSTIN pattern (2-digit state + PAN + entity no. + Z + check).",
      evidence: {},
    };
  }
  const state = value.slice(0, 2);
  if (!GST_STATE_CODES[state]) {
    return { ...base, level: "invalid", message: `Unknown GST state code ${state}.`, evidence: { state } };
  }
  const expected = gstinCheckChar(value.slice(0, 14));
  if (expected !== value[14]) {
    return {
      ...base,
      level: "invalid",
      message: "Check digit does not match. There is probably a typo.",
      evidence: { expectedCheck: expected },
    };
  }
  const pan = value.slice(2, 12);
  return {
    ...base,
    level: "format_valid",
    message: "Format and check digit are correct. Not yet confirmed with the GST registry.",
    evidence: { state, stateName: GST_STATE_CODES[state], pan, holderType: PAN_HOLDER_TYPES[pan[3]] },
  };
}

/**
 * IEC has equalled the entity's PAN since DGFT's 2020 migration. When a GSTIN is also
 * given, its characters 3 to 12 are that same PAN, so the two must agree.
 */
export function verifyIec(raw: string, gstinRaw?: string | null): VerificationResult {
  const value = clean(raw);
  const base = { field: "iec", value, verifier: "iec-format@1" };
  if (LEGACY_IEC_RE.test(value)) {
    return {
      ...base,
      level: "format_valid",
      message: "Legacy numeric IEC. Cannot be cross-checked against the GSTIN.",
      evidence: { legacy: true },
    };
  }
  if (!PAN_RE.test(value)) {
    return { ...base, level: "invalid", message: "IEC must be the 10-character PAN of the entity.", evidence: {} };
  }
  const gstin = gstinRaw ? clean(gstinRaw) : "";
  if (gstin && GSTIN_RE.test(gstin)) {
    const gstinPan = gstin.slice(2, 12);
    if (gstinPan !== value) {
      return {
        ...base,
        level: "invalid",
        message: `IEC does not match the PAN inside your GSTIN (${gstinPan}). Both belong to the same entity, so they must match.`,
        evidence: { gstinPan },
      };
    }
    return {
      ...base,
      level: "format_valid",
      message: "Format is valid and matches the PAN in your GSTIN. Not yet confirmed with DGFT.",
      evidence: { crossCheckedWithGstin: true, holderType: PAN_HOLDER_TYPES[value[3]] },
    };
  }
  return {
    ...base,
    level: "format_valid",
    message: "Format is valid. Not yet confirmed with DGFT.",
    evidence: { crossCheckedWithGstin: false, holderType: PAN_HOLDER_TYPES[value[3]] },
  };
}

export function verifyPhone(raw: string): VerificationResult {
  const m = raw.replace(/[\s()-]/g, "").match(PHONE_RE);
  if (!m) {
    return {
      field: "phone",
      value: raw,
      level: "invalid",
      verifier: "phone-format@1",
      message: "Enter a 10-digit Indian mobile number.",
      evidence: {},
    };
  }
  return {
    field: "phone",
    value: `+91${m[1]}`,
    level: "format_valid",
    verifier: "phone-format@1",
    message: "Valid mobile format. Not yet confirmed by OTP.",
    evidence: {},
  };
}

export function verifyDrivingLicence(raw: string): VerificationResult {
  const value = clean(raw);
  const m = value.match(DL_RE);
  if (!m) {
    // State formats vary historically; don't block, just don't vouch for it.
    return {
      field: "drivingLicence",
      value,
      level: "self_declared",
      verifier: "dl-format@1",
      message: "Not in the standard national format. Recorded as typed.",
      evidence: {},
    };
  }
  return {
    field: "drivingLicence",
    value,
    level: "format_valid",
    verifier: "dl-format@1",
    message: "Standard national format. Not yet confirmed with SARATHI.",
    evidence: { state: m[1], rto: m[2], year: m[3] },
  };
}

/** Free text and identifiers with no public format or source yet. */
export function selfDeclared(field: string, value: string, message = "Entered by the user. Not checked."): VerificationResult {
  return { field, value, level: "self_declared", verifier: "none", message, evidence: {} };
}

const GOV_EMAIL_DOMAINS = ["gov.in", "nic.in"];

/**
 * Email is "owned" only once a verification step has proven it (not enabled in the prototype,
 * so emails are self-declared). For official roles, also note whether it is a government domain.
 */
export function verifyEmail(email: string, emailVerified: boolean, officialRole: boolean): VerificationResult {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const governmentDomain = GOV_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
  return {
    field: "email",
    value: email,
    level: emailVerified ? "owned" : "self_declared",
    verifier: emailVerified ? "email-verification@1" : "none",
    message:
      (emailVerified ? "Verified." : "Entered at sign-up. Not verified.") +
      (officialRole && !governmentDomain ? " Not a government email domain." : ""),
    evidence: { domain, governmentDomain },
  };
}
