"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Package, Plus, Route, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { countryName } from "@/lib/format";

type Item = { caseCode: string; exportPortCode: string; destinationCountry: string };

const SECTIONS: Array<{ key: string; label: string; path: string; Icon: LucideIcon }> = [
  { key: "overview", label: "Overview", path: "", Icon: Route },
  { key: "documents", label: "Documents", path: "/documents", Icon: FileText },
  { key: "checks", label: "Checks", path: "/checks", Icon: ShieldCheck },
  { key: "people", label: "People & invites", path: "/people", Icon: Users },
];

/** Which section of a case a path is in: /cases/CODE is the overview, /cases/CODE/documents/new/… is documents. */
export function sectionOf(pathname: string, base: string): string | null {
  if (pathname === base) return "overview";
  if (!pathname.startsWith(`${base}/`)) return null;
  const seg = pathname.slice(base.length + 1).split("/")[0];
  return SECTIONS.some((s) => s.key === seg) ? seg : "overview";
}

const row = "flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] transition-colors duration-150";
const idle = "text-slate hover:bg-surface hover:text-ink";
const current = "bg-surface font-medium text-ink";

/**
 * Pick a case, then one of its four sections. Only the open case shows its sections; the rest stay one line
 * each so a long list stays scannable.
 */
export function SidebarNav({ cases, canCreate }: { cases: Item[]; canCreate: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Cases" className="space-y-6">
      <Link href="/dashboard" aria-current={pathname === "/dashboard" ? "page" : undefined} className={cn(row, pathname === "/dashboard" ? current : idle)}>
        <LayoutDashboard size={18} strokeWidth={1.8} aria-hidden="true" />
        Dashboard
      </Link>

      <div>
        <div className="mb-1 flex items-center justify-between px-3">
          <h2 className="text-micro-upper text-steel">Cases</h2>
          {canCreate ? (
            <Link href="/cases/new" title="New case" aria-label="New case" className="grid h-7 w-7 place-items-center rounded-md text-slate transition-colors duration-150 hover:bg-surface hover:text-ink">
              <Plus size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {cases.length ? (
          <ul className="space-y-0.5">
            {cases.map((c) => {
              const base = `/cases/${c.caseCode}`;
              const section = sectionOf(pathname, base);
              const open = section !== null;
              return (
                <li key={c.caseCode}>
                  <Link href={base} aria-current={section === "overview" ? "page" : undefined} className={cn(row, "items-start", open ? "text-ink" : idle, open && "font-medium")}>
                    <Package size={18} strokeWidth={1.8} className={cn("mt-0.5 shrink-0", open ? "text-primary" : "")} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px]">{c.caseCode}</span>
                      <span className="block truncate text-caption font-normal text-steel">
                        {c.exportPortCode} to {countryName(c.destinationCountry)}
                      </span>
                    </span>
                  </Link>
                  {/* Opens smoothly: the row grows from 0fr to 1fr instead of popping in. */}
                  <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                    <ul className="min-h-0 overflow-hidden" inert={!open}>
                      {SECTIONS.map(({ key, label, path, Icon }) => (
                        <li key={key}>
                          <Link
                            href={`${base}${path}`}
                            aria-current={section === key ? "page" : undefined}
                            className={cn("ml-5 flex items-center gap-2.5 rounded-md border-l border-hairline py-1.5 pl-4 pr-3 text-[14px] transition-colors duration-150", section === key ? "border-primary bg-surface font-medium text-ink" : idle)}
                          >
                            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-2 text-body-sm text-steel">{canCreate ? "No cases yet. Create one to get started." : "Cases you are invited to appear here."}</p>
        )}
      </div>
    </nav>
  );
}

/** Shown while the case list loads. */
export function SidebarSkeleton() {
  return (
    <div className="hidden w-64 shrink-0 space-y-3 border-r border-hairline px-3 py-6 lg:block" aria-hidden="true">
      <div className="h-9 animate-pulse rounded-md bg-surface" />
      <div className="h-4 w-16 animate-pulse rounded bg-surface" />
      <div className="h-12 animate-pulse rounded-md bg-surface" />
      <div className="h-12 animate-pulse rounded-md bg-surface" />
    </div>
  );
}
