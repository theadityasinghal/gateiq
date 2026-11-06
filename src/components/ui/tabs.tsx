import Link from "next/link";
import { cn } from "@/lib/cn";

export function SegmentedTabs({ tabs, active }: { tabs: Array<{ key: string; label: string; href: string; count?: number }>; active: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-hairline" aria-label="Sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-[14px] font-medium",
            t.key === active ? "border-ink text-ink" : "border-transparent text-steel",
          )}
        >
          {t.label}
          {t.count != null ? <span className="ml-1.5 text-stone">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
