import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "@/db";
import { profile, user } from "@/db/schema";
import type { Role } from "@/lib/roles";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: Role | null;
  username: string | null;
  phone: string | null;
  phoneCountry: string | null;
  hasProfile: boolean;
};

/** Data Access Layer: the single place that reads the session. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      username: user.username,
      phone: user.phone,
      phoneCountry: user.phoneCountry,
      profileUserId: profile.userId,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.id, s.user.id));
  if (!row) return null;
  const { profileUserId, ...rest } = row;
  return { ...rest, hasProfile: !!profileUserId };
});

export type OnboardedUser = CurrentUser & { role: Role; username: string };

/** Signed in, with a role, a profile and a username; otherwise send the user to the step they are missing. */
export async function requireOnboardedUser(): Promise<OnboardedUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  if (!u.role) redirect("/onboarding");
  if (!u.hasProfile) redirect("/onboarding/profile");
  // Accounts made before usernames existed pick one once.
  if (!u.username) redirect("/onboarding/username");
  return u as OnboardedUser;
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  return u;
}
