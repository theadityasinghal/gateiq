/**
 * Loads reference masters into Postgres. Run with: npm run masters:import -- <uqc|iso|ports|hs> [csv]
 * With no arguments, loads uqc + iso (the masters that ship with the repo or the runtime).
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json" with { type: "json" };
import { countryMaster, currencyMaster, hsCodeMaster, portMaster, uqcMaster } from "../../src/db/schema";
import { parseCsv } from "./csv";
import { createSql, databaseUrl } from "../../src/db/client";

config({ path: ".env.local" });
const client = createSql(databaseUrl(), { max: 1 });
const db = drizzle(client);

async function upsertInChunks<T extends Record<string, unknown>>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 1000) await insert(rows.slice(i, i + 1000));
}

async function importUqc() {
  const rows = parseCsv(readFileSync(resolve("data/masters/uqc.csv"), "utf8")).map((r) => ({
    code: r.code.toUpperCase(),
    description: r.description,
    tonnesFactor: r.tonnes_factor ? Number(r.tonnes_factor) : null,
    source: "GSTN UQC list",
  }));
  await db.insert(uqcMaster).values(rows).onConflictDoUpdate({
    target: uqcMaster.code,
    set: { description: sql`excluded.description`, tonnesFactor: sql`excluded.tonnes_factor`, source: sql`excluded.source` },
  });
  console.log(`UQC: ${rows.length} units`);
}

async function importIso() {
  countries.registerLocale(en);
  const names = countries.getNames("en", { select: "official" });
  const countryRows = Object.entries(names).map(([code, name]) => ({ code, name, source: "ISO 3166-1 (i18n-iso-countries)" }));
  await db.insert(countryMaster).values(countryRows).onConflictDoUpdate({
    target: countryMaster.code,
    set: { name: sql`excluded.name`, source: sql`excluded.source` },
  });

  const display = new Intl.DisplayNames(["en"], { type: "currency" });
  const currencyRows = Intl.supportedValuesOf("currency").map((code) => ({
    code,
    name: display.of(code) ?? code,
    source: "ISO 4217 (ICU)",
  }));
  await db.insert(currencyMaster).values(currencyRows).onConflictDoUpdate({
    target: currencyMaster.code,
    set: { name: sql`excluded.name`, source: sql`excluded.source` },
  });
  console.log(`ISO: ${countryRows.length} countries, ${currencyRows.length} currencies`);
}

async function importPorts(file: string) {
  const rows = parseCsv(readFileSync(resolve(file), "utf8")).map((r, i) => {
    const code = (r.code ?? "").trim().toUpperCase();
    if (!/^IN[A-Z]{3}[0-9A-Z]$/.test(code)) throw new Error(`Row ${i + 2}: "${r.code}" is not a 6-character customs location code`);
    if (!r.name) throw new Error(`Row ${i + 2}: name is required`);
    return { code, name: r.name.trim(), kind: r.kind?.trim() || null, state: r.state?.trim() || null, source: `CBIC location list (${file})` };
  });
  await upsertInChunks(rows, (chunk) =>
    db.insert(portMaster).values(chunk).onConflictDoUpdate({
      target: portMaster.code,
      set: { name: sql`excluded.name`, kind: sql`excluded.kind`, state: sql`excluded.state`, source: sql`excluded.source` },
    }),
  );
  console.log(`Ports: ${rows.length} customs locations`);
}

async function importHs(file: string) {
  const rows = parseCsv(readFileSync(resolve(file), "utf8")).map((r, i) => {
    const code = (r.code ?? "").replace(/[\s.]/g, "");
    if (!/^\d{8}$/.test(code)) throw new Error(`Row ${i + 2}: "${r.code}" is not an 8-digit ITC-HS code`);
    if (!r.description) throw new Error(`Row ${i + 2}: description is required`);
    return { code, description: r.description.trim(), source: `DGFT ITC-HS (${file})` };
  });
  await upsertInChunks(rows, (chunk) =>
    db.insert(hsCodeMaster).values(chunk).onConflictDoUpdate({
      target: hsCodeMaster.code,
      set: { description: sql`excluded.description`, source: sql`excluded.source` },
    }),
  );
  console.log(`ITC-HS: ${rows.length} codes`);
}

async function main() {
  const [what, file] = process.argv.slice(2);
  switch (what) {
    case undefined:
      await importUqc();
      await importIso();
      break;
    case "uqc":
      await importUqc();
      break;
    case "iso":
      await importIso();
      break;
    case "ports":
    case "hs":
      if (!file) throw new Error(`Usage: npm run masters:import -- ${what} path/to/file.csv`);
      await (what === "ports" ? importPorts(file) : importHs(file));
      break;
    default:
      throw new Error(`Unknown master "${what}". Use uqc, iso, ports or hs.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
