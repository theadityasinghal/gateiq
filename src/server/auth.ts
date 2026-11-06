import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { user, session, account, verification } from "@/db/schema";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. See .env.example.`);
  return v;
}

/**
 * Email + password sign-in. Users, sessions and password hashes (scrypt) live in our own
 * Postgres tables (no Supabase Auth).
 *
 * Prototype decision: the email address is trusted as typed. There is no verification link
 * or OTP, so the email shows as "self-declared" on the profile. Turning on
 * `requireEmailVerification` (and wiring an email sender) is the upgrade path.
 */
export const auth = betterAuth({
  secret: required("BETTER_AUTH_SECRET"),
  baseURL: required("BETTER_AUTH_URL"),
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  rateLimit: { enabled: true },
  plugins: [nextCookies()],
});
