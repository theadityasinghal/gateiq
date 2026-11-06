"use client";

import { cn } from "@/lib/cn";
import { THEME_KEY } from "@/lib/theme";

/**
 * Switches between the black theme (default) and the light theme. Which icon shows is decided by
 * CSS from <html data-theme>, so the button never disagrees with the page during hydration.
 */
export function ThemeToggle({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked: the switch still applies for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between black and light theme"
      title="Switch theme"
      className={cn(
        "grid h-9 w-9 place-items-center rounded-md border transition-colors duration-150",
        onDark ? "border-on-dark-muted/50 text-on-dark" : "border-hairline text-slate",
        className,
      )}
    >
      {/* Shown in the black theme: offers the light theme */}
      <svg viewBox="0 0 20 20" className="theme-icon-sun h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.99 3.99l1.41 1.41M14.6 14.6l1.41 1.41M3.99 16.01l1.41-1.41M14.6 5.4l1.41-1.41" strokeLinecap="round" />
      </svg>
      {/* Shown in the light theme: offers the black theme */}
      <svg viewBox="0 0 20 20" className="theme-icon-moon h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
