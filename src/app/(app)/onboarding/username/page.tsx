import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { UsernameForm } from "./username-form";

export const metadata = { title: "Choose a username" };

export default async function UsernamePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.username) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">Choose a username</h1>
      <p className="mt-2 text-slate">
        People on GateIQ add each other to cases by username. Pick one you&apos;re happy to share. It can&apos;t be changed later.
      </p>
      <UsernameForm />
    </div>
  );
}
