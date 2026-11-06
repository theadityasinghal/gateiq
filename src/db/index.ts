import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { createSql, databaseUrl, withReadRetry } from "./client";
import * as schema from "./schema";

// One pool per server instance; reused across hot reloads in development.
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof createSql> };
const url = databaseUrl();
const client = globalForDb.pg ?? withReadRetry(createSql(url), url);
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export type Db = typeof db;
export { schema };
