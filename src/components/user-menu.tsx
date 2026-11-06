import Link from "next/link";
import { getCurrentUser } from "@/server/session";
import { ROLE_INFO } from "@/lib/roles";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-[14px] font-medium leading-tight text-ink">{user.name}</p>
        <p className="text-caption text-steel">{user.role ? ROLE_INFO[user.role].label : "No role yet"}</p>
      </div>
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.image} alt="" className="h-8 w-8 rounded-full border border-hairline" referrerPolicy="no-referrer" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-tint-lavender text-[13px] font-semibold text-tag-purple-fg">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      {user.hasProfile ? (
        <Link href="/onboarding/profile" className="hidden text-[14px] font-medium text-link-blue sm:inline">
          Profile
        </Link>
      ) : null}
      <SignOutButton />
    </div>
  );
}
