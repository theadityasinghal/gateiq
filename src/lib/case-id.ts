import { randomInt } from "node:crypto";

/**
 * Case codes look like GIQ-26-7K3M9Q2X:
 *   "GIQ" · 2-digit year · 7 random Crockford base32 characters + 1 check character.
 * The check character uses the Luhn mod-32 algorithm over year + random part. It catches every
 * single mistyped character and every adjacent swap except "0" ↔ "Z" (Luhn's known blind spot).
 * Codes are not sequential and are hard to guess, but a code never grants access.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I, L, O, U
const N = ALPHABET.length;
const RANDOM_LEN = 7;
const CODE_RE = /^GIQ-(\d{2})-([0-9A-HJKMNP-TV-Z]{8})$/;

export function luhnCheckChar(input: string): string {
  let factor = 2;
  let sum = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    const code = ALPHABET.indexOf(input[i]);
    if (code < 0) throw new Error(`Invalid character: ${input[i]}`);
    let addend = factor * code;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }
  return ALPHABET[(N - (sum % N)) % N];
}

function luhnValid(input: string): boolean {
  let factor = 1;
  let sum = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    const code = ALPHABET.indexOf(input[i]);
    if (code < 0) return false;
    let addend = factor * code;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / N) + (addend % N);
    sum += addend;
  }
  return sum % N === 0;
}

export function generateCaseCode(now: Date = new Date(), rand: (max: number) => number = randomInt): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, "0");
  let body = "";
  for (let i = 0; i < RANDOM_LEN; i++) body += ALPHABET[rand(N)];
  return `GIQ-${yy}-${body}${luhnCheckChar(yy + body)}`;
}

/** Normalise user input the Crockford way (I/L→1, O→0), uppercase, fix separators. */
export function normalizeCaseCode(input: string): string {
  const compact = input
    .toUpperCase()
    .replace(/[\s_-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  // Restore the "GIQ" prefix if the 1/0 substitution touched it.
  const fixed = compact.replace(/^G1Q/, "GIQ");
  const m = fixed.match(/^GIQ(\d{2})([0-9A-Z]{8})$/);
  return m ? `GIQ-${m[1]}-${m[2]}` : input.trim().toUpperCase();
}

export function isValidCaseCode(input: string): boolean {
  const m = normalizeCaseCode(input).match(CODE_RE);
  return !!m && luhnValid(m[1] + m[2]);
}
