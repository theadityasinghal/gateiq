import Link from "next/link";
import { cn } from "@/lib/cn";

/** GateIQ mark: a gate arch with a check bar. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("h-7 w-7", className)} aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="#5645d4" />
      <path d="M7 21V12a7 7 0 0 1 14 0v9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10.5 16.2l2.4 2.4 4.6-4.9" fill="none" stroke="#f9e79f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ dark = false, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label="GateIQ home">
      <LogoMark />
      <span className={cn("text-[18px] font-semibold tracking-[-0.3px]", dark ? "text-on-dark" : "text-ink")}>GateIQ</span>
    </Link>
  );
}
