import { Tag } from "./badge";
import type { VerificationLevel } from "@/lib/verify/types";

const map: Record<VerificationLevel, { label: string; tone: "green" | "purple" | "orange" | "gray" | "red" }> = {
  owned: { label: "Owned", tone: "green" },
  exists: { label: "Exists", tone: "purple" },
  format_valid: { label: "Format valid", tone: "gray" },
  self_declared: { label: "Self-declared", tone: "orange" },
  invalid: { label: "Invalid", tone: "red" },
};

export function VerificationBadge({ level, message }: { level: VerificationLevel; message?: string }) {
  const m = map[level];
  return (
    <Tag tone={m.tone} title={message}>
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
