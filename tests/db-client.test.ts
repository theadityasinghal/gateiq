import { describe, expect, it, vi } from "vitest";
import { isReadOnly, isTransient, withReadRetry } from "@/db/client";

function fakeSql(failures: Array<{ code: string } | null>) {
  const calls: string[] = [];
  let i = 0;
  const unsafe = (query: string) => {
    calls.push(query);
    const failure = failures[i++] ?? null;
    const p = failure ? Promise.reject(Object.assign(new Error("boom"), failure)) : Promise.resolve([{ ok: 1 }]);
    p.catch(() => {});
    return Object.assign(p, { values: () => p.then((r) => (Array.isArray(r) ? r.map((x) => Object.values(x)) : r)) });
  };
  return { sql: { unsafe, begin: vi.fn() } as never, calls };
}

describe("db client", () => {
  it("classifies reads and transient errors", () => {
    expect(isReadOnly(" SELECT 1")).toBe(true);
    expect(isReadOnly("insert into x values (1)")).toBe(false);
    expect(isReadOnly("with x as (delete from y returning *) select * from x")).toBe(false);
    expect(isTransient({ code: "ECONNRESET" })).toBe(true);
    expect(isTransient({ code: "23505" })).toBe(false);
  });

  it("retries a SELECT once after a dropped connection", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sql, calls } = fakeSql([{ code: "ECONNRESET" }]);
    const wrapped = withReadRetry(sql, "postgres://x@host/db");
    await expect(wrapped.unsafe("select 1", []).values()).resolves.toEqual([[1]]);
    expect(calls).toHaveLength(2);
    warn.mockRestore();
  });

  it("never retries writes", async () => {
    const { sql, calls } = fakeSql([{ code: "ECONNRESET" }]);
    const wrapped = withReadRetry(sql, "postgres://x@host/db");
    await expect(wrapped.unsafe("insert into t values (1)", [])).rejects.toThrow("boom");
    expect(calls).toHaveLength(1);
  });

  it("does not retry real query errors", async () => {
    const { sql, calls } = fakeSql([{ code: "42P01" }]);
    const wrapped = withReadRetry(sql, "postgres://x@host/db");
    await expect(wrapped.unsafe("select * from missing", [])).rejects.toThrow("boom");
    expect(calls).toHaveLength(1);
  });

  it("leaves transactions untouched", () => {
    const { sql } = fakeSql([]);
    expect(withReadRetry(sql, "postgres://x@host/db").begin).toBe((sql as { begin: unknown }).begin);
  });
});
