"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { caseDocument, fieldVerification, profile, shipmentCase, user } from "@/db/schema";
import { ROLES, ROLE_INFO, roleFields } from "@/lib/roles";
import { getCurrentUser } from "@/server/session";
import { audit } from "@/server/audit";
import { removeObjects } from "@/server/storage";
import { removeUserFromAllCases } from "@/server/cases/membership";
import { verifyProfile } from "./profile-verification";

export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values, echoed back so the form keeps them after a failed submit. */
  values?: Record<string, string>;
};

/** Onboarding step 1. Once a profile exists, account type changes go through changeRole on /profile. */
export async function chooseRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = await getCurrentUser();
  if (!current) redirect("/sign-in");
  if (current.hasProfile) redirect("/profile");
  const parsed = z.enum(ROLES).safeParse(formData.get("role"));
  if (!parsed.success) return { error: "Choose one of the account types." };
  const role = parsed.data;

  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, current.id));
  await audit({ actorId: current.id, action: "user.role_set", entityType: "user", entityId: current.id, details: { from: current.role, to: role } });
  revalidatePath("/", "layout");
  redirect("/onboarding/profile");
}

/**
 * Switches account type. Everything tied to the old type is deleted: its profile fields, their
 * verification results, the role-specific ID, and (for consignors) every case the user owns.
 */
export async function changeRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = await getCurrentUser();
  if (!current) redirect("/sign-in");
  if (!current.role || !current.hasProfile) redirect("/onboarding");
  const parsed = z.enum(ROLES).safeParse(formData.get("role"));
  if (!parsed.success) return { error: "Choose one of the account types." };
  const from = current.role;
  const to = parsed.data;
  if (from === to) return { error: "That is already your account type." };
  if (formData.get("confirm") !== "yes") return { error: "Tick the box to confirm you understand what will be deleted." };

  const keep = new Set(roleFields(to));
  const cleared = roleFields(from).filter((f) => !keep.has(f));
  const oldIdKey = ROLE_INFO[from].idField?.key;
  const clearedChecks: string[] = [...cleared, ...(oldIdKey ? [oldIdKey] : [])];

  const docPaths: string[] = [];
  const deletedCases: string[] = [];

  await db.transaction(async (tx) => {
    if (from === "consignor") {
      const cases = await tx
        .select({ id: shipmentCase.id, code: shipmentCase.caseCode })
        .from(shipmentCase)
        .where(eq(shipmentCase.ownerId, current.id));
      if (cases.length) {
        const ids = cases.map((c) => c.id);
        const docs = await tx.select({ path: caseDocument.storagePath }).from(caseDocument).where(inArray(caseDocument.caseId, ids));
        docPaths.push(...docs.map((d) => d.path));
        deletedCases.push(...cases.map((c) => c.code));
        // Goods lines, submissions and their files cascade from the case.
        await tx.delete(shipmentCase).where(and(eq(shipmentCase.ownerId, current.id), inArray(shipmentCase.id, ids)));
      }
    }

    // Invites were made for the old account type, so access through them ends too.
    const leftCases = await removeUserFromAllCases(tx, current.id);

    await tx
      .update(profile)
      .set({ ...Object.fromEntries(cleared.map((f) => [f, null])), extra: {}, updatedAt: new Date() })
      .where(eq(profile.userId, current.id));
    if (clearedChecks.length) {
      await tx
        .delete(fieldVerification)
        .where(and(eq(fieldVerification.userId, current.id), inArray(fieldVerification.field, clearedChecks)));
    }
    await tx.update(user).set({ role: to, updatedAt: new Date() }).where(eq(user.id, current.id));
    await audit(
      {
        actorId: current.id,
        action: "user.role_changed",
        entityType: "user",
        entityId: current.id,
        details: { from, to, clearedFields: clearedChecks, deletedCases, deletedDocuments: docPaths.length, leftCases },
      },
      tx,
    );
  });

  // Storage is outside the database transaction. A failure here leaves unreachable private files, not exposed ones.
  try {
    await removeObjects(docPaths);
  } catch (e) {
    console.error("changeRole: could not remove stored documents", e);
  }

  revalidatePath("/", "layout");
  redirect("/profile?changed=1");
}

const optional = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const baseSchema = z.object({
  legalName: z.string().trim().min(2, "Enter your full legal name.").max(200),
  organisation: optional,
  address: optional,
  phone: z.string().trim().min(1, "Enter your mobile number.").max(32),
  phoneCountry: z.string().length(2, "Choose a country code."),
  iec: optional,
  gstin: optional,
  idValue: optional,
  returnTo: z.enum(["dashboard", "profile"]).optional(),
});

/** Saves the profile. Only the legal name and mobile number are required; every other field is optional. */
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = await getCurrentUser();
  if (!current) redirect("/sign-in");
  if (!current.role) redirect("/onboarding");
  const role = current.role;

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    if (fieldErrors.phoneCountry && !fieldErrors.phone) fieldErrors.phone = fieldErrors.phoneCountry;
    return { fieldErrors, values: raw };
  }
  const data = parsed.data;
  const fieldErrors: Record<string, string> = {};

  const idKey = ROLE_INFO[role].idField?.key;
  const extra: Record<string, string> = idKey && data.idValue ? { [idKey]: data.idValue } : {};

  const results = verifyProfile(
    role,
    {
      legalName: data.legalName,
      organisation: data.organisation,
      iec: data.iec,
      gstin: data.gstin,
      address: data.address,
      phone: data.phone,
      phoneCountry: data.phoneCountry,
      extra,
    },
    { email: current.email, emailVerified: current.emailVerified },
  );
  for (const r of results) {
    if (r.level === "invalid") fieldErrors[r.field === idKey ? "idValue" : r.field] = r.message;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: raw };

  const valueOf = (field: string) => results.find((r) => r.field === field)?.value ?? undefined;
  const cleanedExtra = idKey && data.idValue ? { [idKey]: valueOf(idKey) ?? data.idValue } : {};
  const fields = new Set(roleFields(role));

  const row = {
    legalName: data.legalName,
    organisation: fields.has("organisation") ? (data.organisation ?? null) : null,
    address: fields.has("address") ? (data.address ?? null) : null,
    iec: fields.has("iec") ? (valueOf("iec") ?? null) : null,
    gstin: fields.has("gstin") ? (valueOf("gstin") ?? null) : null,
    extra: cleanedExtra,
    updatedAt: new Date(),
  };
  const phone = valueOf("phone")!;

  await db.transaction(async (tx) => {
    await tx
      .insert(profile)
      .values({ userId: current.id, ...row })
      .onConflictDoUpdate({ target: profile.userId, set: row });
    await tx
      .update(user)
      .set({ phone, phoneCountry: data.phoneCountry, updatedAt: new Date() })
      .where(eq(user.id, current.id));
    // Fields no longer present lose their old verification rows.
    await tx.delete(fieldVerification).where(eq(fieldVerification.userId, current.id));
    await tx.insert(fieldVerification).values(
      results.map((r) => ({
        userId: current.id,
        field: r.field,
        value: r.value,
        level: r.level,
        verifier: r.verifier,
        evidence: { ...r.evidence, message: r.message },
      })),
    );
    await audit(
      {
        actorId: current.id,
        action: current.hasProfile ? "profile.updated" : "profile.created",
        entityType: "profile",
        entityId: current.id,
        details: { role, levels: Object.fromEntries(results.map((r) => [r.field, r.level])) },
      },
      tx,
    );
  });

  revalidatePath("/", "layout");
  if (data.returnTo === "profile") return { ok: true };
  redirect("/dashboard");
}
