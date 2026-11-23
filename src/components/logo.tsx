import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * GateIQ mark: a gate seen head-on (two nested arches, like a tunnel you pass through) with a check at its
 * centre. Keep in step with `src/app/icon.svg`, which is the same drawing for the browser tab.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id="giq-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7a66f0" />
          <stop offset="1" stopColor="#4130b5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#giq-bg)" />
      <path d="M6.5 25.5V15a9.5 9.5 0 0 1 19 0v10.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 25.5V15.5a5 5 0 0 1 10 0v10" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.9 16.6l2.5 2.5 4.3-4.9" fill="none" stroke="#f9d96a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ dark = false, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="GateIQ home">
      <LogoMark />
      <span className={cn("text-[19px] font-semibold tracking-[-0.4px]", dark ? "text-on-dark" : "text-ink")}>
        GateIQ
      </span>
    </Link>
  );
}
