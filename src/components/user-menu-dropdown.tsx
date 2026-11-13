"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

type MenuUser = { name: string; username: string | null; roleLabel: string; image: string | null; onboarded: boolean };

const item = "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[14px] text-charcoal transition-colors duration-150 hover:bg-surface focus-visible:bg-surface focus-visible:outline-none";

/** The signed-in user's name in the header. Opens a menu with Dashboard, Profile and Sign out. */
export function UserMenuDropdown({ user }: { user: MenuUser }) {
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Open for the page it was opened on, so going somewhere closes it without an effect.
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => root.current && !root.current.contains(e.target as Node) && setOpenOn(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        root.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  const avatar = user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.image} alt="" className="h-8 w-8 rounded-full border border-hairline" referrerPolicy="no-referrer" />
  ) : (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-tint-lavender text-[13px] font-semibold text-tag-purple-fg">{user.name.slice(0, 1).toUpperCase()}</span>
  );

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-md py-1 pl-2 pr-2 transition-colors duration-150 hover:bg-surface"
      >
        <span className="hidden text-right sm:block">
          <span className="block text-[14px] font-medium leading-tight text-ink">{user.name}</span>
          <span className="block text-caption text-steel">
            {user.username ? `@${user.username} · ` : ""}
            {user.roleLabel}
          </span>
        </span>
        {avatar}
        <ChevronDown size={16} strokeWidth={1.8} className={cn("text-steel transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>

      <div
        role="menu"
        aria-label="Account"
        className={cn(
          "absolute right-0 top-full z-50 mt-2 w-60 origin-top-right rounded-lg border border-hairline bg-canvas p-1.5 shadow-modal",
          "transition-[opacity,transform] duration-150 ease-out",
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
        )}
        inert={!open}
      >
        <div className="border-b border-hairline-soft px-3 pb-2.5 pt-1.5 sm:hidden">
          <p className="text-[14px] font-medium text-ink">{user.name}</p>
          <p className="text-caption text-steel">{user.roleLabel}</p>
        </div>
        {user.onboarded ? (
          <>
            <Link href="/dashboard" role="menuitem" className={item}>
              <LayoutDashboard size={16} strokeWidth={1.8} className="text-steel" aria-hidden="true" />
              Dashboard
            </Link>
            <Link href="/profile" role="menuitem" className={item}>
              <UserRound size={16} strokeWidth={1.8} className="text-steel" aria-hidden="true" />
              Profile
            </Link>
          </>
        ) : null}
        <button type="button" role="menuitem" onClick={signOut} disabled={signingOut} className={cn(item, "disabled:opacity-60")}>
          <LogOut size={16} strokeWidth={1.8} className="text-steel" aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
