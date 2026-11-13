import { getCurrentUser } from "@/server/session";
import { ROLE_INFO } from "@/lib/roles";
import { UserMenuDropdown } from "./user-menu-dropdown";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <UserMenuDropdown
      user={{
        name: user.name,
        username: user.username,
        roleLabel: user.role ? ROLE_INFO[user.role].label : "No role yet",
        image: user.image,
        onboarded: !!user.role && user.hasProfile && !!user.username,
      }}
    />
  );
}
