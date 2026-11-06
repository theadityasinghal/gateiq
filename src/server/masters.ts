import "server-only";
import { asc, count, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { countryMaster, currencyMaster, hsCodeMaster, portMaster, uqcMaster } from "@/db/schema";
import type { UnitFactors } from "@/lib/normalize/shipping-bill";

export async function getUqcUnits() {
  return db.select().from(uqcMaster).orderBy(asc(uqcMaster.code));
}

export async function getMassUnits() {
  return db.select().from(uqcMaster).where(isNotNull(uqcMaster.tonnesFactor)).orderBy(asc(uqcMaster.code));
}

export async function getUnitFactors(): Promise<UnitFactors> {
  const rows = await db.select({ code: uqcMaster.code, f: uqcMaster.tonnesFactor }).from(uqcMaster);
  return Object.fromEntries(rows.map((r) => [r.code, r.f]));
}

export async function getCurrencies() {
  return db.select().from(currencyMaster).orderBy(asc(currencyMaster.code));
}

export async function getCountries() {
  return db.select().from(countryMaster).orderBy(asc(countryMaster.name));
}

export async function findPort(code: string) {
  const [row] = await db.select().from(portMaster).where(eq(portMaster.code, code.toUpperCase()));
  return row ?? null;
}

export async function findHsCode(code: string) {
  const [row] = await db.select().from(hsCodeMaster).where(eq(hsCodeMaster.code, code));
  return row ?? null;
}

/** Which masters have been imported. Lookups against an empty master are skipped, not failed. */
export async function masterStatus() {
  const [[ports], [hs], [uqc], [cur], [ctry]] = await Promise.all([
    db.select({ n: count() }).from(portMaster),
    db.select({ n: count() }).from(hsCodeMaster),
    db.select({ n: count() }).from(uqcMaster),
    db.select({ n: count() }).from(currencyMaster),
    db.select({ n: count() }).from(countryMaster),
  ]);
  return { ports: ports.n, hsCodes: hs.n, uqc: uqc.n, currencies: cur.n, countries: ctry.n };
}
