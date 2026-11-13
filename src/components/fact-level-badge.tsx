import { BadgeCheck, CircleCheck, CircleDashed, Eye, type LucideIcon } from "lucide-react";
import { Tag } from "@/components/ui/badge";
import { FACT_LEVEL_HELP, FACT_LEVEL_LABEL, type FactLevel } from "@/lib/facts/ladder";

export const LEVEL_ICON: Record<FactLevel, LucideIcon> = { declared: CircleDashed, confirmed: CircleCheck, source_verified: BadgeCheck, observed: Eye };
const TONE = { declared: "gray", confirmed: "green", source_verified: "sky", observed: "purple" } as const;

/** Where a verified value stands on the ladder: declared, confirmed, source-verified, observed. */
export function LevelBadge({ level }: { level: FactLevel }) {
  const Icon = LEVEL_ICON[level];
  return (
    <Tag tone={TONE[level]} title={FACT_LEVEL_HELP[level]}>
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {FACT_LEVEL_LABEL[level]}
    </Tag>
  );
}
