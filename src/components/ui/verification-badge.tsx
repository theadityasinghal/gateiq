import { BadgeCheck, CircleCheck, CircleX, Pencil, ShieldCheck, type LucideIcon } from "lucide-react";
import { Tag } from "./badge";
import type { VerificationLevel } from "@/lib/verify/types";

const map: Record<VerificationLevel, { label: string; tone: "green" | "purple" | "orange" | "gray" | "red"; Icon: LucideIcon }> = {
  owned: { label: "Owned", tone: "green", Icon: ShieldCheck },
  exists: { label: "Exists", tone: "purple", Icon: BadgeCheck },
  format_valid: { label: "Format valid", tone: "gray", Icon: CircleCheck },
  self_declared: { label: "Self-declared", tone: "orange", Icon: Pencil },
  invalid: { label: "Invalid", tone: "red", Icon: CircleX },
};

export function VerificationBadge({ level, message }: { level: VerificationLevel; message?: string }) {
  const m = map[level];
  return (
    <Tag tone={m.tone} title={message}>
      <m.Icon size={13} strokeWidth={2} aria-hidden="true" />
      {m.label}
    </Tag>
  );
}

export const LEVEL_EXPLAINER: Record<VerificationLevel, string> = {
  owned: "You proved you control it.",
  exists: "An official registry confirmed it is real.",
  format_valid: "Well-formed and internally consistent. Not yet confirmed with a registry.",
  self_declared: "As you typed it. Nothing checked yet.",
  invalid: "A check ran and failed.",
};
