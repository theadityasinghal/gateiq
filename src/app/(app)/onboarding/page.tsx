import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { RolePicker } from "./role-picker";

export const metadata = { title: "Choose your account type" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // After onboarding, account type changes happen on /profile, where the data loss is spelled out.
  if (user.hasProfile) redirect("/profile");
  return (
    <div className="mx-auto max-w-[1040px]">
      <p className="text-micro-upper text-steel">Step 1 of 2</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">Choose your account type</h1>
      <p className="mt-2 max-w-[640px] text-slate">
        Pick the role you play in moving a consignment. One role per account for now.
      </p>
      <RolePicker current={user.role} />
    </div>
  );
}
