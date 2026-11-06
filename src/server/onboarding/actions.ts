"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldVerification, profile, shipmentCase, user } from "@/db/schema";
import { ROLES, ROLE_INFO, type Role } from "@/lib/roles";
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

export async function chooseRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = await getCurrentUser();
  if (!current) redirect("/sign-in");
  const parsed = z.enum(ROLES).safeParse(formData.get("role"));
  if (!parsed.success) return { error: "Choose one of the account types." };
  const role = parsed.data;

  if (current.role && current.role !== role) {
    // Changing role after creating cases would orphan that work.
    const [{ n }] = await db.select({ n: count() }).from(shipmentCase).where(eq(shipmentCase.ownerId, current.id));
    if (n > 0) return { error: "You already have cases under your current role, so the role can't be changed." };
  }

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
  phone: optional,
  iec: optional,
  gstin: optional,
  idValue: optional,
});

function requiredFor(role: Role): Array<keyof z.infer<typeof baseSchema>> {
  if (role === "consignor") return ["legalName", "iec", "gstin", "address", "phone"];
  const req: Array<keyof z.infer<typeof baseSchema>> = ["legalName", "organisation", "phone"];
  if (ROLE_INFO[role].idField) req.push("idValue");
  return req;
}

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
    return { fieldErrors, values: raw };
  }
  const data = parsed.data;
  const fieldErrors: Record<string, string> = {};
  for (const key of requiredFor(role)) if (!data[key]) fieldErrors[key] = "Required.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: raw };

  const idKey = ROLE_INFO[role].idField?.key;
  const extra: Record<string, string> = idKey && data.idValue ? { [idKey]: data.idValue } : {};

  const results = verifyProfile(
    role,
    { legalName: data.legalName, organisation: data.organisation, iec: data.iec, gstin: data.gstin, address: data.address, phone: data.phone, extra },
    { email: current.email, emailVerified: current.emailVerified },
  );
  for (const r of results) {
    if (r.level === "invalid") fieldErrors[r.field === idKey ? "idValue" : r.field] = r.message;
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: raw };

  const valueOf = (field: string) => results.find((r) => r.field === field)?.value ?? undefined;
  const cleanedExtra = idKey && data.idValue ? { [idKey]: valueOf(idKey) ?? data.idValue } : {};

  const row = {
    legalName: data.legalName,
    organisation: data.organisation ?? null,
    address: data.address ?? null,
    phone: valueOf("phone") ?? null,
    iec: role === "consignor" ? (valueOf("iec") ?? null) : null,
    gstin: role === "consignor" ? (valueOf("gstin") ?? null) : null,
    extra: cleanedExtra,
    updatedAt: new Date(),
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(profile)
      .values({ userId: current.id, ...row })
      .onConflictDoUpdate({ target: profile.userId, set: row });
    // Fields no longer present (e.g. after a role change) lose their old verification rows.
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
  redirect("/dashboard");
}
