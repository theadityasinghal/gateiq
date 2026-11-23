import { CircleCheck, CircleDot, CircleX, MessageSquareText, TriangleExclamationPoint, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CheckStatus } from "@/lib/checks/types";

type Kind = CheckStatus | "explained";

/** One symbol per check outcome, used everywhere a check result is shown. The words live in `title`. */
export const STATUS: Record<Kind, { Icon: LucideIcon; label: string; color: string }> = {
  invalid: { Icon: CircleX, label: "Needs fixing", color: "text-error" },
  mismatch: { Icon: CircleX, label: "Needs fixing", color: "text-error" },
  warning: { Icon: TriangleExclamationPoint, label: "Please check", color: "text-tag-orange-fg" },
  agree: { Icon: CircleCheck, label: "Matches", color: "text-tag-green-fg" },
  single: { Icon: CircleDot, label: "Only one document", color: "text-stone" },
  explained: { Icon: MessageSquareText, label: "Explained", color: "text-steel" },
};

export function StatusIcon({ kind, className, size = 18 }: { kind: Kind; className?: string; size?: number }) {
  const { Icon, label, color } = STATUS[kind];
  return <Icon size={size} strokeWidth={1.8} className={cn("shrink-0", color, className)} aria-label={label} role="img" />;
}

/** An icon with a count beside it, e.g. ✕ 2. Renders nothing for zero. */
export function StatusCount({ kind, n, className }: { kind: Kind; n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[14px] font-semibold tabular-nums", STATUS[kind].color, className)} title={`${n} · ${STATUS[kind].label}`}>
      <StatusIcon kind={kind} size={16} />
      {n} <span className="font-medium">{STATUS[kind].label.toLowerCase()}</span>
    </span>
  );
}

const TAG_BG: Record<Kind, string> = {
  invalid: "bg-tag-red-bg text-tag-red-fg",
  mismatch: "bg-tag-red-bg text-tag-red-fg",
  warning: "bg-tint-peach text-tag-orange-fg",
  agree: "bg-tint-mint text-tag-green-fg",
  single: "bg-tint-gray text-slate",
  explained: "bg-tint-sky text-tag-sky-fg",
};

/** The status as an icon plus its words, so nothing depends on knowing what a symbol means. */
export function StatusTag({ kind, label, className }: { kind: Kind; label?: string; className?: string }) {
  const { Icon, label: text } = STATUS[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-[13px] font-semibold leading-[1.4]", TAG_BG[kind], className)}>
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {label ?? text}
    </span>
  );
}

/** A small square button holding only an icon; the label is for screen readers and the tooltip. */
export function iconButtonClass(tone: "default" | "danger" = "default") {
  return cn(
    "grid h-9 w-9 place-items-center rounded-md transition-colors duration-150 active:bg-surface hover:bg-surface",
    tone === "danger" ? "text-error" : "text-slate hover:text-ink",
  );
}
