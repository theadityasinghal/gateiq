/**
 * Freight container numbers (ISO 6346), e.g. MSKU 123456 5:
 *   3-letter owner code · category letter (U container, J detachable equipment, Z trailer) ·
 *   6-digit serial · 1 check digit.
 * The check digit catches every single mistyped character and most swaps, so a container number
 * can be flagged as wrong on its own, before any other document is compared with it.
 */

const LETTER_VALUES: Record<string, number> = (() => {
  // A = 10, counting up and skipping multiples of 11 (11, 22, 33).
  const out: Record<string, number> = {};
  let v = 10;
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (v % 11 === 0) v++;
    out[ch] = v++;
  }
  return out;
})();

const FORMAT_RE = /^[A-Z]{3}[UJZ]\d{7}$/;

/** Uppercases and drops spaces, hyphens and anything else that isn't a letter or digit. */
export function normalizeContainerNo(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The check digit for the first 10 characters (owner code, category, serial). */
export function containerCheckDigit(first10: string): number {
  const s = first10.toUpperCase();
  if (!/^[A-Z]{4}\d{6}$/.test(s)) throw new Error(`Not a container number prefix: ${first10}`);
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = s[i];
    const value = i < 4 ? LETTER_VALUES[ch] : Number(ch);
    sum += value * 2 ** i;
  }
  return (sum % 11) % 10;
}

export function hasContainerFormat(input: string): boolean {
  return FORMAT_RE.test(normalizeContainerNo(input));
}

export function isValidContainerNo(input: string): boolean {
  const s = normalizeContainerNo(input);
  return FORMAT_RE.test(s) && containerCheckDigit(s.slice(0, 10)) === Number(s[10]);
}

/**
 * For a well-formed number whose check digit fails: the numbers one small slip away that pass.
 * Tries a wrong check digit, one wrong serial digit, and two neighbouring digits swapped.
 * The owner code is left alone (owner codes are registered; guessing them is not useful).
 */
export function suggestContainerNo(input: string, limit = 3): string[] {
  const s = normalizeContainerNo(input);
  if (!FORMAT_RE.test(s) || isValidContainerNo(s)) return [];
  const out = new Set<string>();
  const prefix = s.slice(0, 10);
  out.add(prefix + containerCheckDigit(prefix));
  const digits = s.slice(4).split("");
  // Adjacent swaps among the 7 digits.
  for (let i = 0; i < 6; i++) {
    if (digits[i] === digits[i + 1]) continue;
    const d = [...digits];
    [d[i], d[i + 1]] = [d[i + 1], d[i]];
    const cand = s.slice(0, 4) + d.join("");
    if (isValidContainerNo(cand)) out.add(cand);
  }
  // One wrong serial digit (positions 4..9), keeping the written check digit.
  for (let i = 4; i < 10; i++) {
    for (let d = 0; d <= 9; d++) {
      if (String(d) === s[i]) continue;
      const cand = s.slice(0, i) + d + s.slice(i + 1);
      if (isValidContainerNo(cand)) out.add(cand);
    }
  }
  return [...out].slice(0, limit);
}

/** "MSKU1234565" → "MSKU 123456 5", the way it is painted on the door. */
export function formatContainerNo(input: string): string {
  const s = normalizeContainerNo(input);
  return FORMAT_RE.test(s) ? `${s.slice(0, 4)} ${s.slice(4, 10)} ${s[10]}` : s;
}

/**
 * Size and type codes: ISO 6346:1995 (22G1, 42G1, 45G1, L5G1, 22R1, 45R1, 22U1, 42P1, 22T6) and the older
 * all-digit codes still seen on terminal forms (2210, 4310, 4510).
 */
export const SIZE_TYPE_RE = /^[24L][0-9][A-Z0-9][0-9]$/;

export type SizeType = { lengthFt: 20 | 40 | 45 | null; highCube: boolean; kind: "general" | "reefer" | "open_top" | "platform" | "tank" | "other" | null };

export function describeSizeType(code: string): SizeType | null {
  const c = code.toUpperCase().replace(/\s/g, "");
  if (!SIZE_TYPE_RE.test(c)) return null;
  const lengthFt = c[0] === "2" ? 20 : c[0] === "4" ? 40 : c[0] === "L" ? 45 : null;
  const highCube = c[1] === "5";
  let kind: SizeType["kind"] = null;
  if (/[A-Z]/.test(c[2])) {
    kind = ({ G: "general", R: "reefer", U: "open_top", P: "platform", T: "tank" } as const)[c[2] as "G"] ?? "other";
  }
  return { lengthFt, highCube, kind };
}

/** Typical empty weight, used only when a VGM declaration doesn't give the tare. An estimate, never a fact. */
export function typicalTareT(lengthFt: 20 | 40 | 45 | null): number | null {
  return lengthFt === 20 ? 2.2 : lengthFt === 40 ? 3.8 : lengthFt === 45 ? 4.8 : null;
}
