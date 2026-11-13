"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, caseDocument, caseSubmission, checkAck, documentExtraction, session, shipmentCase, user } from "@/db/schema";
import { auth } from "@/server/auth";
import { audit } from "@/server/audit";
import { getCurrentUser } from "@/server/session";
import { removeObjects } from "@/server/storage";
import { deleteCasesCascade } from "@/server/cases/delete";
import { removeUserFromAllCases } from "@/server/cases/membership";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { normalizeUsername } from "@/lib/username";

const emailSchema = z.string().trim().toLowerCase().max(254, "That email is too long.").pipe(z.email("Enter a valid email address."));

/** Changes the email address. The username, which is what people sign in with, never changes. */
export async function changeEmail(rawEmail: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return fail("Sign in again to do this.");
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
  const email = parsed.data;
  if (email === me.email) return ok;
  const [taken] = await db.select({ id: user.id }).from(user).where(and(eq(user.email, email), ne(user.id, me.id)));
  if (taken) return fail("Another account already uses that email.");
  try {
    await db.transaction(async (tx) => {
      await tx.update(user).set({ email, emailVerified: false, updatedAt: new Date() }).where(eq(user.id, me.id));
      await audit({ actorId: me.id, action: "user.email_changed", entityType: "user", entityId: me.id, details: {} }, tx);
    });
  } catch {
    return fail("Another account already uses that email.");
  }
  revalidatePath("/", "layout");
  return ok;
}

/**
 * Sets a new password without asking for the old one, as the product requires. Because anyone holding an open
 * session could do this, every other session of the account is ended; this device stays signed in.
 */
export async function changePassword(newPassword: string, confirm: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return fail("Sign in again to do this.");
  if (typeof newPassword !== "string" || newPassword.length < 8) return fail("Use at least 8 characters for your password.");
  if (newPassword.length > 128) return fail("Use at most 128 characters for your password.");
  if (newPassword !== confirm) return fail("The two passwords don't match.");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);
  const current = await auth.api.getSession({ headers: await headers() });
  await db.transaction(async (tx) => {
    await ctx.internalAdapter.updatePassword(me.id, hash);
    await tx.delete(session).where(current ? and(eq(session.userId, me.id), ne(session.id, current.session.id)) : eq(session.userId, me.id));
    await audit({ actorId: me.id, action: "user.password_changed", entityType: "user", entityId: me.id, details: {} }, tx);
  });
  return ok;
}

/**
 * Deletes the account and what it added: the cases it owns, its documents, notes, verified values and readings
 * on other people's cases, and its access to every case. Typing the username confirms it. Stored files are
 * removed after the database commit. The client then signs out and leaves.
 */
export async function deleteAccount(typedUsername: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return fail("Sign in again to do this.");
  if (!me.username || normalizeUsername(typedUsername) !== me.username) return fail("Type your username exactly to confirm.");

  const paths: string[] = [];
  await db.transaction(async (tx) => {
    const owned = await tx.select({ id: shipmentCase.id }).from(shipmentCase).where(eq(shipmentCase.ownerId, me.id));
    paths.push(...(await deleteCasesCascade(tx, owned.map((c) => c.id))));

    // What they added to cases they don't own.
    const [files, readings] = await Promise.all([
      tx.select({ path: caseDocument.storagePath }).from(caseDocument).where(eq(caseDocument.uploadedBy, me.id)),
      tx.select({ path: documentExtraction.storagePath }).from(documentExtraction).where(eq(documentExtraction.userId, me.id)),
    ]);
    paths.push(...files.map((f) => f.path), ...readings.map((r) => r.path));
    await tx.delete(caseDocument).where(eq(caseDocument.uploadedBy, me.id));
    await tx.delete(caseSubmission).where(eq(caseSubmission.addedBy, me.id));
    await tx.delete(documentExtraction).where(eq(documentExtraction.userId, me.id));
    await tx.delete(checkAck).where(eq(checkAck.userId, me.id));
    await tx.update(caseSubmission).set({ removedBy: null }).where(eq(caseSubmission.removedBy, me.id));
    await tx.update(auditLog).set({ actorId: null }).where(eq(auditLog.actorId, me.id));

    // Their access, and everyone they brought in. Verified values they set or confirmed, sessions, profile and
    // checks cascade from the user row.
    await removeUserFromAllCases(tx, me.id);
    await audit({ actorId: null, action: "user.deleted", entityType: "user", entityId: me.id, details: { ownedCases: owned.length } }, tx);
    await tx.delete(user).where(eq(user.id, me.id));
  });

  try {
    await removeObjects([...new Set(paths)]);
  } catch (e) {
    console.error("deleteAccount: could not remove stored documents", e);
  }
  revalidatePath("/", "layout");
  return ok;
}

