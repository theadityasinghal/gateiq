import { getCurrentUser } from "@/server/session";
import { listCaseNav } from "@/server/cases/service";
import { NavToggle, SidebarPanel } from "./app-shell";
import { SidebarNav } from "./sidebar-nav";

/** Anyone who hasn't finished onboarding has no cases, so they get no sidebar. */
async function onboardedUser() {
  const u = await getCurrentUser();
  return u?.role && u.hasProfile && u.username ? { id: u.id, role: u.role } : null;
}

export async function AppSidebar() {
  const user = await onboardedUser();
  if (!user) return null;
  const cases = await listCaseNav(user.id);
  return (
    <SidebarPanel>
      <SidebarNav cases={cases} canCreate={user.role === "consignor"} />
    </SidebarPanel>
  );
}

export async function NavToggleGate() {
  return (await onboardedUser()) ? <NavToggle /> : null;
}
