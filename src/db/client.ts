import postgres from "postgres";

/**
 * One Postgres connection string for the app, migrations and scripts (`SUPABASE_DB`),
 * same as the Dexel setup. `DATABASE_URL` is accepted as a fallback.
 */
export function databaseUrl(): string {
  const url = process.env.SUPABASE_DB ?? process.env.DATABASE_URL;
  if (!url) throw new Error("SUPABASE_DB is not set. Copy .env.example to .env.local and fill it in.");
  return url;
}

/** Errors that mean the connection dropped, not that the query was wrong. */
const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "CONNECT_TIMEOUT",
  "QUERY_STALLED", // no answer in time: the connection is probably dead (see withReadRetry)
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
]);

export function isTransient(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return !!code && TRANSIENT_CODES.has(code);
}

/** Only plain reads are safe to replay: a write can fail after Postgres has already committed it. */
export function isReadOnly(query: string): boolean {
  return /^\s*select\b/i.test(query);
}

function ipv6Hint(url: string, err: unknown) {
  if (/@db\.[^.]+\.supabase\.co/.test(url) && isTransient(err)) {
    console.error(
      "[db] Could not reach db.<ref>.supabase.co, which is IPv6-only. On an IPv4 network, use the Supabase " +
        "connection pooler URI (aws-0-<region>.pooler.supabase.com:6543) in SUPABASE_DB.",
    );
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Sql = ReturnType<typeof postgres>;

/** A plain read that hasn't answered after this long is on a connection that died while the function was idle. */
const READ_STALL_MS = 4000;

/**
 * Wraps `sql.unsafe` (what Drizzle calls for every non-transaction query) so that a SELECT
 * which fails on a dropped connection is retried once on a fresh one, after 500 ms.
 * A SELECT that doesn't answer at all within `stallMs` is retried at once: the silent kind of dead
 * connection (a serverless function frozen between requests while the pooler hangs up) never errors, it
 * just hangs, and the retry opens a new connection because the stuck one is still busy.
 * Writes and anything inside `sql.begin` (transactions) are never retried.
 */
export function withReadRetry(sql: Sql, url: string, stallMs = READ_STALL_MS): Sql {
  const unsafe = sql.unsafe.bind(sql);
  type Mode = "rows" | "values";

  const run = async (mode: Mode, args: Parameters<Sql["unsafe"]>) => {
    const read = isReadOnly(String(args[0]));
    const exec = () => {
      const p = mode === "values" ? unsafe(...args).values() : unsafe(...args);
      if (!read) return p;
      let timer: ReturnType<typeof setTimeout>;
      const stall = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(`Query had no answer after ${stallMs} ms`), { code: "QUERY_STALLED" })), stallMs);
      });
      return Promise.race([p, stall]).finally(() => clearTimeout(timer));
    };
    // Set GATEIQ_DB_TIMING=1 to log every query's duration (Vercel function logs show where a page spends its time).
    const started = process.env.GATEIQ_DB_TIMING ? performance.now() : 0;
    try {
      const result = await exec();
      if (started) console.log(`[db-timing] ${Math.round(performance.now() - started)}ms ${String(args[0]).replace(/\s+/g, " ").slice(0, 80)}`);
      return result;
    } catch (err) {
      ipv6Hint(url, err);
      if (!isTransient(err) || !read) throw err;
      const stalled = (err as { code?: string }).code === "QUERY_STALLED";
      console.warn(`[db] ${stalled ? "Query stalled" : `Transient connection error (${(err as { code?: string }).code})`}. Retrying read once.`);
      if (!stalled) await sleep(500);
      return exec();
    }
  };

  const retryingUnsafe = (...args: Parameters<Sql["unsafe"]>) => {
    let promise: Promise<unknown> | undefined;
    const rows = () => (promise ??= run("rows", args));
    return {
      then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => rows().then(res, rej),
      catch: (rej: (e: unknown) => unknown) => rows().catch(rej),
      finally: (f: () => void) => rows().finally(f),
      values: () => run("values", args),
    };
  };

  return new Proxy(sql, {
    get(target, prop, receiver) {
      if (prop === "unsafe") return retryingUnsafe;
      return Reflect.get(target, prop, receiver);
    },
  }) as Sql;
}

/**
 * Pool settings mirror Dexel's asyncpg pool, adjusted for serverless functions:
 * SSL required, no prepared statements (Supabase's pooler runs in transaction mode),
 * 10 s connect timeout, idle connections closed after 20 s, and a small pool per function instance.
 */
export function createSql(url = databaseUrl(), opts: { max?: number } = {}): Sql {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
  return postgres(url, {
    ssl: local ? false : "require",
    prepare: false,
    connect_timeout: 10,
    // Close idle connections quickly: a function that sleeps between requests otherwise wakes up holding
    // connections the pooler has already dropped.
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    max: opts.max ?? 5,
    // One query per connection at a time. With more queries in flight than connections, postgres.js
    // otherwise pipelines them on one connection, and Supabase's transaction pooler (port 6543)
    // stalls on that: the page hangs until something times out. Extra queries now wait for a free connection.
    max_pipeline: 1,
  });
}
