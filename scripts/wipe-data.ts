/**
 * Deletes every account, case, document and audit row, and every uploaded file. Irreversible.
 * Keeps the reference masters (ports, HS codes, currencies, countries, units) and the migration history.
 *
 *   CONFIRM_WIPE=<supabase project ref> npm run db:wipe -- --yes
 *
 * It refuses to run unless --yes is given and CONFIRM_WIPE equals the project ref in SUPABASE_URL, so it can
 * only ever be pointed at the project it names. Local files are never touched.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createSql, databaseUrl } from "../src/db/client";

config({ path: ".env.local" });

const COUNTED = [
  "user", "session", "account", "profile", "case", "case_goods_line", "case_member", "case_submission", "case_document",
  "document_extraction", "check_ack", "case_fact", "case_fact_confirmation", "audit_log", "rate_limit", "verification",
];
const KEPT = ["port_master", "hs_code_master", "uqc_master", "currency_master", "country_master"];

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not set.");
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  if (!process.argv.includes("--yes")) throw new Error("Add --yes to confirm you want every account, case and file deleted.");
  if (process.env.CONFIRM_WIPE !== ref) throw new Error(`Set CONFIRM_WIPE=${ref} to confirm this is the project to wipe.`);

  const sql = createSql(databaseUrl(), { max: 1 });
  const count = async (tables: string[]) => {
    const out: Record<string, number> = {};
    for (const t of tables) out[t] = Number((await sql.unsafe(`select count(*) as n from "${t}"`))[0].n);
    return out;
  };

  console.log(`Project ${ref}`);
  console.log("Before:", await count(COUNTED));
  console.log("Kept:  ", await count(KEPT));

  // Every table that references these cascades, so one statement clears them all.
  await sql.unsafe('TRUNCATE TABLE "user", "case", rate_limit, verification, audit_log RESTART IDENTITY CASCADE');

  let removed = 0;
  if (key) {
    const bucket = createClient(supabaseUrl, key, { auth: { persistSession: false } }).storage.from(process.env.SUPABASE_DOCUMENTS_BUCKET ?? "case-documents");
    // Files live at <case id>/<file>: list the folders, then each folder's files, until none are left.
    for (let guard = 0; guard < 1000; guard++) {
      const { data: folders, error } = await bucket.list("", { limit: 100 });
      if (error) throw new Error(`Listing storage failed: ${error.message}`);
      if (!folders?.length) break;
      for (const f of folders) {
        const { data: files } = await bucket.list(f.name, { limit: 1000 });
        const paths = files?.length ? files.map((x) => `${f.name}/${x.name}`) : [f.name];
        const { error: rmError } = await bucket.remove(paths);
        if (rmError) throw new Error(`Removing files failed: ${rmError.message}`);
        removed += paths.length;
      }
    }
  } else {
    console.log("SUPABASE_SECRET_KEY is not set: stored files were left alone.");
  }

  console.log("After: ", await count(COUNTED));
  console.log("Kept:  ", await count(KEPT));
  console.log(`Stored files removed: ${removed}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
