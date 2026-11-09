import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { countryMaster, currencyMaster, hsCodeMaster, portMaster, uqcMaster } from "@/db/schema";
import { masterStatus } from "@/server/masters";

/** The hidden JSON "payload" field the case and filing forms send. */
export function parsePayload(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function fileOrNull(v: FormDataEntryValue | null): File | null {
  return v instanceof File && v.size > 0 ? v : null;
}

/** Checks codes against the reference masters. A master that hasn't been imported is skipped, not failed. */
export async function checkAgainstMasters(checks: {
  ports?: Array<[string, string]>;
  hsCodes?: Array<[string, string]>; // [fieldKey, code]
  uqc?: Array<[string, string]>;
  massUnits?: Array<[string, string]>;
  currencies?: Array<[string, string]>;
  countries?: Array<[string, string]>;
}): Promise<Record<string, string>> {
  const status = await masterStatus();
  const errors: Record<string, string> = {};
  const lookup = async <T>(rows: Array<[string, string]> | undefined, loaded: number, fetch: (codes: string[]) => Promise<T[]>, key: (r: T) => string, message: (c: string) => string) => {
    if (!rows?.length || loaded === 0) return;
    const found = new Set((await fetch([...new Set(rows.map((r) => r[1]))])).map(key));
    for (const [field, code] of rows) if (!found.has(code)) errors[field] = message(code);
  };
  await lookup(
    checks.ports,
    status.ports,
    (codes) => db.select({ code: portMaster.code }).from(portMaster).where(inArray(portMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not in the customs location master.`,
  );
  await lookup(
    checks.hsCodes,
    status.hsCodes,
    (codes) => db.select({ code: hsCodeMaster.code }).from(hsCodeMaster).where(inArray(hsCodeMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not in the ITC-HS master.`,
  );
  if (status.uqc === 0 && (checks.massUnits?.length || checks.uqc?.length)) {
    errors._form = "Unit reference data (UQC) has not been imported yet. Run npm run masters:import.";
  }
  await lookup(
    checks.uqc,
    status.uqc,
    (codes) => db.select({ code: uqcMaster.code }).from(uqcMaster).where(inArray(uqcMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not a UQC unit.`,
  );
  await lookup(
    checks.massUnits,
    status.uqc,
    (codes) =>
      db.select({ code: uqcMaster.code, f: uqcMaster.tonnesFactor }).from(uqcMaster).where(inArray(uqcMaster.code, codes)),
    (r) => (r.f == null ? "" : r.code),
    (c) => `${c} is not a unit of weight.`,
  );
  await lookup(
    checks.currencies,
    status.currencies,
    (codes) => db.select({ code: currencyMaster.code }).from(currencyMaster).where(inArray(currencyMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not an ISO 4217 currency.`,
  );
  await lookup(
    checks.countries,
    status.countries,
    (codes) => db.select({ code: countryMaster.code }).from(countryMaster).where(inArray(countryMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not an ISO 3166 country.`,
  );
  return errors;
}

