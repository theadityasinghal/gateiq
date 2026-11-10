import { ROLE_INFO, ROLES, lostOnRoleChange } from "@/lib/roles";
import { listPhoneCountries } from "@/lib/phone";
import { requireOnboardedUser } from "@/server/session";
import { loadProfileForm } from "@/server/onboarding/profile-data";
import { ProfileForm } from "../onboarding/profile/profile-form";
import { RoleChangeForm } from "./role-change-form";
import { Card } from "@/components/ui/card";
import { AtSign, Info } from "lucide-react";

export const metadata = { title: "Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const user = await requireOnboardedUser();
  const { changed } = await searchParams;
  const { initial, checks } = await loadProfileForm(user);
  const info = ROLE_INFO[user.role];
  const options = ROLES.filter((r) => r !== user.role).map((r) => ({
    role: r,
    label: ROLE_INFO[r].label,
    lost: lostOnRoleChange(user.role, r),
  }));

  return (
    <div className="mx-auto max-w-[720px]">
      <p className="text-micro-upper text-steel">{info.label}</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">Profile</h1>
      <p className="mt-2 text-body-sm text-slate">
        <AtSign size={14} className="mr-1 inline" aria-hidden="true" />Username <span className="font-mono font-medium text-charcoal">@{user.username}</span>. Others use it to add you to cases. It can&apos;t be changed.
      </p>
      {changed ? (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-lg bg-surface p-4 text-body-sm text-charcoal">
          <Info size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-steel" aria-hidden="true" />
          <span>Your account type is now {info.label}. Fill in any details for it below.</span>
        </p>
      ) : null}

      <ProfileForm role={user.role} email={user.email} initial={initial} checks={checks} countries={listPhoneCountries()} returnTo="profile" />

      <Card className="mt-10 space-y-4">
        <div>
          <h2 className="text-h5">Account type</h2>
          <p className="text-body-sm text-slate">
            Currently <span className="font-medium text-charcoal">{info.label}</span>. Your name, email and mobile number stay. Anything that
            belongs only to your current account type is deleted and can&apos;t be recovered.
          </p>
        </div>
        <RoleChangeForm options={options} />
      </Card>
    </div>
  );
}
