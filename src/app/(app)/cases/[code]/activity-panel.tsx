"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  BadgeCheck,
  Circle,
  Eraser,
  FilePen,
  FileUp,
  MessageSquareText,
  PackagePlus,
  ScanText,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { ActivityItem } from "@/server/cases/service";
import { ACTIVITY_GROUP_LABEL, describeEvent, type ActivityGroup, type ActivityIcon, type ActivityTone } from "@/lib/audit-events";
import { dayHeading, dayKey, formatDateTime, formatTime } from "@/lib/format";
import { ROLE_INFO } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const ICONS: Record<ActivityIcon, LucideIcon> = {
  case: PackagePlus,
  upload: FileUp,
  edit: FilePen,
  trash: Trash2,
  scan: ScanText,
  note: MessageSquareText,
  badge: BadgeCheck,
  shield: ShieldCheck,
  swap: ArrowRightLeft,
  eraser: Eraser,
  invite: UserPlus,
  accept: UserCheck,
  decline: UserX,
  remove: UserMinus,
  dot: Circle,
};

const TONE: Record<ActivityTone, string> = {
  green: "bg-tint-mint text-tag-green-fg",
  purple: "bg-tint-lavender text-tag-purple-fg",
  sky: "bg-tint-sky text-tag-sky-fg",
  orange: "bg-tint-peach text-tag-orange-fg",
  red: "bg-tag-red-bg text-tag-red-fg",
  gray: "bg-tint-gray text-slate",
};

const FILTERS: Array<"all" | ActivityGroup> = ["all", "documents", "people", "verified", "case"];

/** Everything that happened on the case, newest first, with who did it. The record behind every other section. */
export function ActivityPanel({ items, viewerUsername }: { items: ActivityItem[]; viewerUsername: string }) {
  const [filter, setFilter] = useState<"all" | ActivityGroup>("all");
  const events = items.map((i) => ({ item: i, ev: describeEvent(i.action, (i.details ?? {}) as Record<string, unknown>) }));
  const shown = events.filter((e) => filter === "all" || e.ev.group === filter);
  const days: Array<{ key: string; rows: typeof shown }> = [];
  for (const row of shown) {
    const key = dayKey(row.item.at);
    const last = days[days.length - 1];
    if (last?.key === key) last.rows.push(row);
    else days.push({ key, rows: [row] });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h5">Activity</h2>
          <p className="text-body-sm text-slate">Who added, corrected, confirmed, explained or removed what, and when. Nothing here can be edited.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter the activity">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-caption font-medium transition-colors duration-150",
              filter === f ? "border-ink bg-ink text-canvas" : "border-hairline-strong text-slate hover:bg-surface",
            )}
          >
            {ACTIVITY_GROUP_LABEL[f]}
          </button>
        ))}
      </div>

      {days.length ? (
        <div className="mt-6 space-y-6">
          {days.map((d) => (
            <section key={d.key}>
              <h3 className="mb-3 text-micro-upper text-steel">{dayHeading(d.key)}</h3>
              <ol>
                {d.rows.map(({ item, ev }, i) => {
                  const Icon = ICONS[ev.icon];
                  const who = item.actor ? (item.actor.username === viewerUsername ? "You" : item.actor.name) : "Deleted account";
                  return (
                    <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < d.rows.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-4 top-9 w-px bg-hairline" /> : null}
                      <span className={cn("relative grid h-8 w-8 shrink-0 place-items-center rounded-full", TONE[ev.tone])}>
                        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[14px] leading-snug text-charcoal">
                          <span className="font-semibold text-ink">{who}</span> {ev.text}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-steel">
                          <time dateTime={new Date(item.at).toISOString()} title={formatDateTime(item.at)}>{formatTime(item.at)}</time>
                          {item.actor?.role ? <Tag tone="gray" className="!px-1.5 !py-0 !text-[11px]">{ROLE_INFO[item.actor.role].label}</Tag> : null}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-lg bg-surface p-6 text-body-sm text-slate">Nothing here yet.</p>
      )}
    </Card>
  );
}
