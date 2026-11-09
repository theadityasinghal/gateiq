import { redirect } from "next/navigation";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { listPhoneCountries } from "@/lib/phone";
import { getCurrentUser } from "@/server/session";
import { loadProfileForm } from "@/server/onboarding/profile-data";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Your profile" };

/** Onboarding step 2. After onboarding, the profile lives at /profile. */
export default async function OnboardingProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.role) redirect("/onboarding");
  if (user.hasProfile) redirect("/profile");
  const { initial, checks } = await loadProfileForm(user as typeof user & { role: Role });

  return (
    <div className="mx-auto max-w-[720px]">
      <p className="text-micro-upper text-steel">Step 2 of 2</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">Your profile</h1>
      <p className="mt-2 text-slate">
        Account type: <span className="font-medium text-charcoal">{ROLE_INFO[user.role].label}</span>
        {" · "}
        <a href="/onboarding" className="font-medium text-link-blue">
          Change
        </a>
      </p>
      <p className="mt-2 text-body-sm text-slate">Only your name and mobile number are required now. You can add the rest later from your profile.</p>
      <ProfileForm role={user.role} email={user.email} initial={initial} checks={checks} countries={listPhoneCountries()} returnTo="dashboard" />
    </div>
  );
}
