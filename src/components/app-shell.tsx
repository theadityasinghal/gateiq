"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

const NavContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });

/** Holds whether the sidebar drawer is open on small screens. The sidebar is always visible from lg up. */
export function NavProvider({ children }: { children: React.ReactNode }) {
  // The drawer is open for the page it was opened on, so going somewhere closes it without an effect.
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return <NavContext.Provider value={{ open, setOpen }}>{children}</NavContext.Provider>;
}

/** The menu button in the header; only shown below lg, where the sidebar is a drawer. */
export function NavToggle() {
  const { open, setOpen } = useContext(NavContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-controls="app-sidebar"
      aria-label={open ? "Close the menu" : "Open the menu"}
      className="grid h-9 w-9 place-items-center rounded-md text-slate transition-colors duration-150 hover:bg-surface lg:hidden"
    >
      {open ? <X size={20} strokeWidth={1.8} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.8} aria-hidden="true" />}
    </button>
  );
}

/** The sidebar: a column beside the page from lg up, a slide-in drawer with a dimmed backdrop below that. */
export function SidebarPanel({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useContext(NavContext);
  return (
    <>
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn("fixed inset-x-0 bottom-0 top-16 z-30 bg-black/50 transition-opacity duration-300 lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <aside
        id="app-sidebar"
        aria-label="Cases"
        className={cn(
          "fixed bottom-0 left-0 top-16 z-40 w-72 max-w-[85vw] overflow-y-auto border-r border-hairline bg-canvas px-3 pb-6 pt-6 shadow-modal",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "lg:sticky lg:top-16 lg:z-0 lg:bottom-auto lg:h-[calc(100dvh-4rem)] lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {children}
      </aside>
    </>
  );
}
