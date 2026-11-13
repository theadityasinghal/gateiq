"use client";

import { usePathname } from "next/navigation";
import { CASE_SECTIONS, sectionOf } from "@/lib/case-sections";
import { CaseSectionLink } from "@/components/case-section-link";
import { SECTION_ICON } from "@/components/case-section-icons";
import { cn } from "@/lib/cn";

/** The case's sections as tabs, for screens too narrow to keep the sidebar open. Switching asks the server for nothing. */
export function CaseSubnav({ caseCode }: { caseCode: string }) {
  const pathname = usePathname();
  const base = `/cases/${caseCode}`;
  const active = sectionOf(pathname, base);
  return (
    <nav aria-label="Sections of this case" className="-mx-4 flex gap-1 overflow-x-auto border-b border-hairline px-4 sm:-mx-8 sm:px-8 lg:hidden">
      {CASE_SECTIONS.map(({ key, label, path }) => {
        const Icon = SECTION_ICON[key];
        return (
          <CaseSectionLink
            key={key}
            href={`${base}${path}`}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-[14px] font-medium transition-colors duration-150",
              active === key ? "border-ink text-ink" : "border-transparent text-steel",
            )}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
            {label}
          </CaseSectionLink>
        );
      })}
    </nav>
  );
}
