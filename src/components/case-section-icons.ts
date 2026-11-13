import { BadgeCheck, FileText, History, Route, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { CaseSectionKey } from "@/lib/case-sections";

export const SECTION_ICON: Record<CaseSectionKey, LucideIcon> = {
  overview: Route,
  verified: BadgeCheck,
  documents: FileText,
  checks: ShieldCheck,
  people: Users,
  activity: History,
};
