import { CircleCheck, CircleDot, CircleX, MessageSquareText, TriangleExclamationPoint, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CheckStatus } from "@/lib/checks/types";

type Kind = CheckStatus | "explained";

/** One symbol per check outcome, used everywhere a check result is shown. The words live in `title`. */
export const STATUS: Record<Kind, { Icon: LucideIcon; label: string; color: string }> = {
  invalid: { Icon: CircleX, label: "Wrong on its own", color: "text-error" },
  mismatch: { Icon: CircleX, label: "Mismatch", color: "text-error" },
  warning: { Icon: TriangleExclamationPoint, label: "Worth a look", color: "text-tag-orange-fg" },
  agree: { Icon: CircleCheck, label: "Agrees", color: "text-tag-green-fg" },
  single: { Icon: CircleDot, label: "One source so far", color: "text-stone" },
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
      {n}
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
