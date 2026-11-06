import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { TeamCredit } from "@/components/team-credit";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-8">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Suspense fallback={<div className="h-8 w-32 rounded-md bg-surface" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-8 sm:py-12">{children}</main>
      <footer className="border-t border-hairline px-4 py-6 sm:px-8">
        <TeamCredit className="mx-auto max-w-[1280px] text-steel" />
      </footer>
    </div>
  );
}
