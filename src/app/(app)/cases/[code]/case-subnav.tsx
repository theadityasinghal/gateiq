"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Route, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { sectionOf } from "@/components/sidebar-nav";

const TABS: Array<{ key: string; label: string; path: string; Icon: LucideIcon }> = [
  { key: "overview", label: "Overview", path: "", Icon: Route },
  { key: "documents", label: "Documents", path: "/documents", Icon: FileText },
  { key: "checks", label: "Checks", path: "/checks", Icon: ShieldCheck },
  { key: "people", label: "People", path: "/people", Icon: Users },
];

/** The case's four sections as tabs, for screens too narrow to keep the sidebar open. */
export function CaseSubnav({ caseCode }: { caseCode: string }) {
  const pathname = usePathname();
  const base = `/cases/${caseCode}`;
  const active = sectionOf(pathname, base);
  return (
    <nav aria-label="Sections of this case" className="-mx-4 flex gap-1 overflow-x-auto border-b border-hairline px-4 sm:-mx-8 sm:px-8 lg:hidden">
      {TABS.map(({ key, label, path, Icon }) => (
        <Link
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
        </Link>
      ))}
    </nav>
  );
}
