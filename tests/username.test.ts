import { describe, expect, it } from "vitest";
import { normalizeUsername, validateUsername } from "@/lib/username";

describe("usernames", () => {
  it("normalises case, spaces and a leading @", () => {
    expect(normalizeUsername("  @Priya.Exports ")).toBe("priya.exports");
    expect(normalizeUsername(undefined)).toBe("");
  });

  it.each(["abc", "priya.exports", "cha_mumbai2", "a".repeat(30)])("accepts %s", (u) => {
    expect(validateUsername(u)).toEqual({ ok: true, username: u });
  });

  it.each([
    ["", "Choose a username."],
    ["ab", "3 to 30"],
    ["a".repeat(31), "3 to 30"],
    ["1abc", "Start your username with a letter."],
    ["_abc", "Start your username with a letter."],
    ["ab-cd", "only letters"],
    ["ab cd", "only letters"],
    ["ab..cd", "two of them"],
    ["abc_", "two of them"],
    ["admin", "reserved"],
    ["@GateIQ", "reserved"],
  ])("rejects %j", (u, message) => {
    const r = validateUsername(u);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain(message);
  });
});
