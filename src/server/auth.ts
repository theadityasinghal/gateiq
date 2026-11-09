import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { user, session, account, verification, rateLimit } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parsePhone } from "@/lib/phone";
import { validateUsername } from "@/lib/username";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. See .env.example.`);
  return v;
}

/**
 * Addresses Vercel gives this deployment (production domain, branch URL, per-deploy URL).
 * Better Auth rejects sign-in from any origin it doesn't know ("Invalid origin"), so these are
 * trusted alongside BETTER_AUTH_URL. Vercel sets them itself; they are absent locally.
 */
const vercelOrigins = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_URL,
]
  .filter((h): h is string => !!h)
  .map((h) => `https://${h}`);

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
  baseURL: process.env.BETTER_AUTH_URL ?? vercelOrigins[0] ?? required("BETTER_AUTH_URL"),
  trustedOrigins: vercelOrigins,
  database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification, rateLimit } }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    // Sent by the sign-up form. Validated and normalised in databaseHooks below, never trusted as sent.
    additionalFields: {
      phone: { type: "string", required: true, input: true },
      phoneCountry: { type: "string", required: true, input: true },
      username: { type: "string", required: true, input: true },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (u) => {
          const name = typeof u.name === "string" ? u.name.trim() : "";
          if (name.length < 2 || name.length > 200) {
            throw new APIError("BAD_REQUEST", { message: "Enter your name (2 to 200 characters)." });
          }
          const phone = parsePhone(u.phoneCountry, u.phone);
          if (!phone.ok) throw new APIError("BAD_REQUEST", { message: phone.message });
          const handle = validateUsername(u.username);
          if (!handle.ok) throw new APIError("BAD_REQUEST", { message: handle.message });
          // The unique index is the real guard; this check only gives a clear message.
          const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.username, handle.username));
          if (taken) throw new APIError("BAD_REQUEST", { message: "That username is taken. Choose another." });
          // `role` is not an additional field, so sign-up can't set it; it is chosen in onboarding.
          return { data: { ...u, name, phone: phone.e164, phoneCountry: phone.country, username: handle.username } };
        },
      },
    },
  },
  // Profile changes (name, phone, role) go through our own validated Server Actions.
  // These endpoints would let a signed-in user write user columns directly, so they are off.
  disabledPaths: ["/update-user", "/change-email", "/delete-user"],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  rateLimit: {
    enabled: true,
    // In-memory counters reset on every serverless cold start; Postgres holds them across instances.
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
    },
  },
  advanced: {
    // Vercel overwrites these with the real client address; a client-sent value is not trusted.
    ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
  },
  plugins: [nextCookies()],
});
