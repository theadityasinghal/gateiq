import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "purple" | "orange" | "green" | "gray" | "red" | "sky";

const tones: Record<Tone, string> = {
  purple: "bg-tint-lavender text-tag-purple-fg",
  orange: "bg-tint-peach text-tag-orange-fg",
  green: "bg-tint-mint text-tag-green-fg",
  gray: "bg-tint-gray text-slate",
  red: "bg-tag-red-bg text-tag-red-fg",
  sky: "bg-tint-sky text-tag-sky-fg",
};

export function Tag({ tone = "gray", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-[13px] font-semibold leading-[1.4]", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-[13px] font-semibold text-on-primary", className)}>
      {children}
    </span>
  );
}
