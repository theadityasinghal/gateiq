import { ROLE_INFO } from "@/lib/roles";
import { listPhoneCountries } from "@/lib/phone";
import { requireOnboardedUser } from "@/server/session";
import { loadProfileForm } from "@/server/onboarding/profile-data";
import { ProfileForm } from "../onboarding/profile/profile-form";
import { DeleteAccountCard, EmailCard, PasswordCard } from "./account-forms";
import { AtSign, Lock } from "lucide-react";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireOnboardedUser();
  const { initial, checks } = await loadProfileForm(user);
  const info = ROLE_INFO[user.role];

  return (
    <div className="mx-auto max-w-[720px] animate-rise">
      <p className="text-micro-upper text-steel">{info.label}</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">Profile</h1>
      <p className="mt-2 text-body-sm text-slate">
        <AtSign size={14} className="mr-1 inline" aria-hidden="true" />Username <span className="font-mono font-medium text-charcoal">@{user.username}</span>. You sign in with it and others use it to add you to cases. It can&apos;t be changed.
      </p>
      <p className="mt-1 text-body-sm text-slate">
        <Lock size={14} className="mr-1 inline" aria-hidden="true" />Account type <span className="font-medium text-charcoal">{info.label}</span>. It is fixed once chosen.
      </p>

      <ProfileForm role={user.role} email={user.email} initial={initial} checks={checks} countries={listPhoneCountries()} returnTo="profile" />
      <EmailCard email={user.email} />
      <PasswordCard />
      <DeleteAccountCard username={user.username} />
    </div>
  );
}
