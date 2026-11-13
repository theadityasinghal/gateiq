"use client";

import { usePathname } from "next/navigation";
import { CASE_SECTIONS, sectionOf, type CaseSectionKey } from "@/lib/case-sections";

/**
 * Shows the section the address names and hides the rest. The server rendered all six once; switching only
 * changes the address, so it is instant. Hidden sections keep their state (a half-typed note stays put).
 */
export function CaseSections({ caseCode, panels }: { caseCode: string; panels: Record<CaseSectionKey, React.ReactNode> }) {
  const pathname = usePathname();
  const active = sectionOf(pathname, `/cases/${caseCode}`) ?? "overview";
  return (
    <>
      {CASE_SECTIONS.map((s) => (
        <section key={s.key} id={`panel-${s.key}`} aria-label={s.label} hidden={s.key !== active} className="animate-rise">
          {panels[s.key]}
        </section>
      ))}
    </>
  );
}
