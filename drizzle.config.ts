import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const url = process.env.SUPABASE_DB ?? process.env.DATABASE_URL;
if (!url) throw new Error("SUPABASE_DB is not set in .env.local");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url, ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : "require" },
  strict: true,
});
