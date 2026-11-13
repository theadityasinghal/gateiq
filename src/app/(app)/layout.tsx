import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { TeamCredit } from "@/components/team-credit";
import { NavProvider } from "@/components/app-shell";
import { AppSidebar, NavToggleGate } from "@/components/app-sidebar";
import { SidebarSkeleton } from "@/components/sidebar-nav";

// Every signed-in page reads the session and the user's own data on each request, so these
// routes are allowed to wait on the server. loading.tsx shows a skeleton meanwhile.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavProvider>
      <div className="flex min-h-dvh flex-col bg-canvas">
        {/* Named so page transitions leave the header where it is. */}
        <header className="sticky top-0 z-20 border-b border-hairline bg-canvas" style={{ viewTransitionName: "site-header" }}>
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Suspense fallback={null}>
                <NavToggleGate />
              </Suspense>
              <Logo href="/dashboard" />
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Suspense fallback={<div className="h-9 w-40 animate-pulse rounded-md bg-surface" />}>
                <UserMenu />
              </Suspense>
            </div>
          </div>
        </header>
        <div className="flex flex-1">
          <Suspense fallback={<SidebarSkeleton />}>
            <AppSidebar />
          </Suspense>
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-8 sm:py-10">{children}</main>
            <footer className="border-t border-hairline px-4 py-6 sm:px-8">
              <TeamCredit className="mx-auto max-w-[1100px] text-steel" />
            </footer>
          </div>
        </div>
      </div>
    </NavProvider>
  );
}
