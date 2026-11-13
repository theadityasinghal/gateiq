"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldVerification, profile, user } from "@/db/schema";
import { ROLES, ROLE_INFO, isSelectableRole, roleFields } from "@/lib/roles";
import { getCurrentUser } from "@/server/session";
import { audit } from "@/server/audit";
import { verifyProfile } from "./profile-verification";

export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values, echoed back so the form keeps them after a failed submit. */
  values?: Record<string, string>;
};

/** Onboarding step 1. The account type is fixed once chosen: there is no way to change it later. */
export async function chooseRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = await getCurrentUser();
  if (!current) redirect("/sign-in");
  if (current.hasProfile) redirect("/profile");
  const parsed = z.enum(ROLES).safeParse(formData.get("role"));
  if (!parsed.success || !isSelectableRole(parsed.data)) return { error: "Choose one of the account types." };
  const role = parsed.data;

  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, current.id));
  await audit({ actorId: current.id, action: "user.role_set", entityType: "user", entityId: current.id, details: { from: current.role, to: role } });
  revalidatePath("/", "layout");
  redirect("/onboarding/profile");
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
