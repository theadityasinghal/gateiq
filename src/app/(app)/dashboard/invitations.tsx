"use client";

import { ArrowRight, Check, Mail, X } from "lucide-react";
import { respondToInvite } from "@/server/cases/members";
import type { PendingInvite } from "@/server/cases/service";
import { ROLE_INFO } from "@/lib/roles";
import { countryName, formatDate } from "@/lib/format";
import { useOptimisticAction } from "@/lib/use-optimistic-action";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";

/** Invitations waiting for an answer. Accepting or declining takes the row away at once; it returns with a message if the server refuses. */
export function Invitations({ invites }: { invites: PendingInvite[] }) {
  const [list, run] = useOptimisticAction(invites, (state: PendingInvite[], id: string) => state.filter((i) => i.id !== id));
  if (!list.length) return null;
  return (
    <section aria-labelledby="invites-heading" className="rounded-lg border border-hairline bg-canvas p-6">
      <div className="mb-4 flex items-center gap-2">
        <Mail size={20} strokeWidth={1.8} className="text-steel" aria-hidden="true" />
        <h2 id="invites-heading" className="text-h5">Invitations</h2>
        <Tag tone="orange">{list.length}</Tag>
      </div>
      <ul className="divide-y divide-hairline-soft">
        {list.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[15px] font-medium text-charcoal">{i.caseCode}</p>
              <p className="text-caption text-steel">
                {i.inviterName} <span className="font-mono">@{i.inviterUsername}</span>
                {i.inviterRole ? ` (${ROLE_INFO[i.inviterRole].label})` : ""} invited you · {i.exportPortCode} <ArrowRight size={12} className="inline" aria-label="to" role="img" /> {countryName(i.destinationCountry)} ·{" "}
                {formatDate(i.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => run(i.id, () => respondToInvite(i.id, false))}><X size={16} strokeWidth={2} aria-hidden="true" />Decline</Button>
              <Button type="button" onClick={() => run(i.id, () => respondToInvite(i.id, true), { success: `You are on case ${i.caseCode}.` })}><Check size={16} strokeWidth={2} aria-hidden="true" />Accept</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
