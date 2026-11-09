import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldVerification, profile } from "@/db/schema";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { DEFAULT_PHONE_COUNTRY, nationalPart } from "@/lib/phone";
import type { CurrentUser } from "@/server/session";
import type { VerificationLevel } from "@/lib/verify/types";

/** Initial values and verification badges for the profile form, for the signed-in user only. */
export async function loadProfileForm(user: CurrentUser & { role: Role }) {
  const [p] = await db.select().from(profile).where(eq(profile.userId, user.id));
  const checks = await db.select().from(fieldVerification).where(eq(fieldVerification.userId, user.id));
  const idKey = ROLE_INFO[user.role].idField?.key;
  return {
    initial: {
      legalName: p?.legalName ?? user.name,
      organisation: p?.organisation ?? "",
      address: p?.address ?? "",
      phone: nationalPart(user.phone),
      phoneCountry: user.phoneCountry ?? DEFAULT_PHONE_COUNTRY,
      iec: p?.iec ?? "",
      gstin: p?.gstin ?? "",
      idValue: (idKey && p?.extra?.[idKey]) || "",
    },
    checks: Object.fromEntries(
      checks.map((c) => [
        c.field === idKey ? "idValue" : c.field,
        { level: c.level as VerificationLevel, message: String((c.evidence as { message?: string }).message ?? "") },
      ]),
    ),
  };
}
