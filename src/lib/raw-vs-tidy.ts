/**
 * What was typed next to the tidied value GateIQ compares, for one document. The checks compare tidied values
 * (uppercased, dates in ISO, weights in tonnes, names with suffixes standardised), which can hide a difference that
 * matters on paper; this puts both side by side. Pure: built from the stored form, normalised record and the
 * provenance the normalisers already write ("input.grossWeight (KGS × 0.001)").
 */

/** Reads "a.b", "lines[0].hsCode" or "lines.0.hsCode" out of a nested object. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export type TidyDiff = { field: string; typed: string; compared: string; how: string };

const show = (v: unknown) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** One row per field whose typed value differs from the value it is compared on. Fields that read the same are left out. */
export function tidyDiffs(form: unknown, normalized: unknown, provenance: Record<string, string> | null | undefined): TidyDiff[] {
  if (!form || !normalized || !provenance) return [];
  const out: TidyDiff[] = [];
  for (const [field, source] of Object.entries(provenance)) {
    const m = source.match(/^input\.([\w.[\]]+)\s*(?:\((.*)\))?$/);
    if (!m) continue; // sums and other derived values have no single typed value
    const typed = show(getPath(form, m[1]));
    const compared = show(getPath(normalized, field));
    if (!typed || !compared || typed.trim() === compared) continue;
    out.push({ field, typed, compared, how: m[2] ?? "tidied" });
  }
  return out;
}

/** Form fields changed, or filled in, after Gemini read the file, as the save recorded them. */
export function readEdits(raw: unknown): { corrected: string[]; typed: string[] } {
  const r = (raw && typeof raw === "object" ? raw : {}) as { corrected?: unknown; typed?: unknown };
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return { corrected: list(r.corrected), typed: list(r.typed) };
}
