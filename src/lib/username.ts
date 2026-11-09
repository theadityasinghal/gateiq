/**
 * Usernames are how people find each other to share a case. Chosen once at sign-up and never changed,
 * because invites and the audit trail refer to them.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

const USERNAME_RE = /^[a-z][a-z0-9_.]*$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "gateiq",
  "support",
  "help",
  "root",
  "system",
  "official",
  "customs",
  "cbic",
  "icegate",
  "me",
  "you",
]);

/** Trims, drops a leading "@" and lowercases. Does not validate. */
export function normalizeUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^@/, "").toLowerCase() : "";
}

export type UsernameResult = { ok: true; username: string } | { ok: false; message: string };

export function validateUsername(value: unknown): UsernameResult {
  const username = normalizeUsername(value);
  if (!username) return { ok: false, message: "Choose a username." };
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return { ok: false, message: `Use ${USERNAME_MIN} to ${USERNAME_MAX} characters for your username.` };
  }
  if (!/^[a-z]/.test(username)) return { ok: false, message: "Start your username with a letter." };
  if (!USERNAME_RE.test(username)) {
    return { ok: false, message: "Use only letters, numbers, dots and underscores in your username." };
  }
  if (/[._]{2}/.test(username) || /[._]$/.test(username)) {
    return { ok: false, message: "Don't end your username with a dot or underscore, or put two of them together." };
  }
  if (RESERVED.has(username)) return { ok: false, message: "That username is reserved. Choose another." };
  return { ok: true, username };
}
