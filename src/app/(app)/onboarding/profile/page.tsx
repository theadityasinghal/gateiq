import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldVerification, profile } from "@/db/schema";
import { ROLE_INFO } from "@/lib/roles";
import { getCurrentUser } from "@/server/session";
import { ProfileForm } from "./profile-form";
import type { VerificationLevel } from "@/lib/verify/types";

export const metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.role) redirect("/onboarding");

  const [p] = await db.select().from(profile).where(eq(profile.userId, user.id));
  const checks = await db.select().from(fieldVerification).where(eq(fieldVerification.userId, user.id));
  const info = ROLE_INFO[user.role];
  const idKey = info.idField?.key;

  return (
    <div className="mx-auto max-w-[720px]">
      <p className="text-micro-upper text-steel">{user.hasProfile ? "Profile" : "Step 2 of 2"}</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">Your profile</h1>
      <p className="mt-2 text-slate">
        Account type: <span className="font-medium text-charcoal">{info.label}</span>
        {" · "}
        <a href="/onboarding" className="font-medium text-link-blue">
          Change
        </a>
      </p>
      <ProfileForm
        role={user.role}
        email={user.email}
        initial={{
          legalName: p?.legalName ?? user.name,
          organisation: p?.organisation ?? "",
          address: p?.address ?? "",
          phone: p?.phone ?? "",
          iec: p?.iec ?? "",
          gstin: p?.gstin ?? "",
          idValue: (idKey && p?.extra?.[idKey]) || "",
        }}
        checks={Object.fromEntries(
          checks.map((c) => [
            c.field === idKey ? "idValue" : c.field,
            { level: c.level as VerificationLevel, message: String((c.evidence as { message?: string }).message ?? "") },
          ]),
        )}
      />
    </div>
  );
}
