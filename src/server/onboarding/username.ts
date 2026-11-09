"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { validateUsername } from "@/lib/username";
import { getCurrentUser } from "@/server/session";
import { audit } from "@/server/audit";
import type { FormState } from "./actions";

/** One-time step for accounts made before usernames existed. A username, once set, is never changed. */
export async function chooseUsername(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = await getCurrentUser();
  if (!current) redirect("/sign-in");
  if (current.username) redirect("/dashboard");
  const raw = String(formData.get("username") ?? "");
  const handle = validateUsername(raw);
  if (!handle.ok) return { error: handle.message, values: { username: raw } };

  const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.username, handle.username));
  if (taken) return { error: "That username is taken. Choose another.", values: { username: raw } };
  try {
    await db
      .update(user)
      .set({ username: handle.username, updatedAt: new Date() })
      .where(and(eq(user.id, current.id), isNull(user.username)));
  } catch {
    // Someone took it between the check and the write (unique index).
    return { error: "That username is taken. Choose another.", values: { username: raw } };
  }
  await audit({ actorId: current.id, action: "user.username_set", entityType: "user", entityId: current.id, details: { username: handle.username } });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
