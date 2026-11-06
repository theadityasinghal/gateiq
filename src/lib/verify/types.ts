/**
 * Verification levels, weakest to strongest. "invalid" means a check ran and failed.
 *  - self_declared: nothing checked (free text, or no checker exists yet)
 *  - format_valid:  well-formed; checksum and cross-field consistency passed
 *  - exists:        an authoritative source confirmed the identifier is real (later: GSP / ULIP)
 *  - owned:         this user proved control of it (email link / OTP / admin review, later)
 */
export type VerificationLevel = "self_declared" | "invalid" | "format_valid" | "exists" | "owned";

export type VerificationResult = {
  field: string;
  value: string | null;
  level: VerificationLevel;
  /** Which verifier produced this, e.g. "gstin-format@1". */
  verifier: string;
  /** Human-readable explanation shown next to the badge. */
  message: string;
  evidence: Record<string, unknown>;
};

/** A pluggable check. Later sources (GSP, ULIP, admin review) implement the same shape. */
export interface Verifier {
  id: string;
  field: string;
  verify(value: string, context: Record<string, string | null | undefined>): Promise<VerificationResult> | VerificationResult;
}

export const LEVEL_RANK: Record<VerificationLevel, number> = {
  invalid: -1,
  self_declared: 0,
  format_valid: 1,
  exists: 2,
  owned: 3,
};
