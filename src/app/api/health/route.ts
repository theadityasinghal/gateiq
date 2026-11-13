import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

const startedAt = Date.now();
let served = 0;

/**
 * Timings of the database as seen from this function, for working out where a slow page spends its time
 * (a Mac measures a different path than Vercel does). Public on purpose and harmless: it returns numbers
 * only. Remove it once the slowness is understood.
 */
export async function GET() {
  await connection();
  const timeOne = async () => {
    const t = performance.now();
    await db.execute(sql`select 1`);
    return Math.round(performance.now() - t);
  };
  const first = await timeOne();
  const second = await timeOne();
  const t = performance.now();
  await Promise.all([timeOne(), timeOne(), timeOne(), timeOne(), timeOne()]);
  const fiveParallel = Math.round(performance.now() - t);
  return Response.json(
    {
      region: process.env.VERCEL_REGION ?? null,
      instanceAgeMs: Date.now() - startedAt,
      requestsOnThisInstance: ++served,
      dbMs: { first, second, fiveParallel },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
