"use client";

import { Users } from "lucide-react";
import { removeMember, inviteToCase, type Invitee } from "@/server/cases/members";
import type { CaseMemberRow } from "@/server/cases/service";
import { ROLE_INFO } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { useOptimisticAction } from "@/lib/use-optimistic-action";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";

type Act = { type: "remove"; id: string } | { type: "add"; member: CaseMemberRow };

/**
 * Everyone on a case, who invited them, and (for those who may invite) the form to add someone. Inviting and
 * removing show at once; if the server refuses, the list goes back and a message says why.
 */
export function PeopleCard({
  caseCode,
  viewer,
  isOwner,
  owner,
  members,
  canInvite,
  invitable,
}: {
  caseCode: string;
  viewer: { id: string; username: string };
  isOwner: boolean;
  owner: { name: string; username: string | null };
  members: CaseMemberRow[];
  canInvite: boolean;
  invitable: string[];
}) {
  const [list, run, pending] = useOptimisticAction<CaseMemberRow[], Act>(members, (state, a) =>
    a.type === "remove" ? state.filter((m) => m.id !== a.id) : [...state, a.member],
  );

  function invite(who: Invitee) {
    const member: CaseMemberRow = {
      id: `pending-${who.username}`,
      userId: "",
      invitedBy: viewer.id,
      status: "pending",
      createdAt: new Date(),
      name: who.name,
      username: who.username,
      role: who.role,
      inviterUsername: viewer.username,
      legalName: null,
      organisation: null,
      address: null,
    };
    run({ type: "add", member }, () => inviteToCase(caseCode, who.username), { success: `Invite sent to @${who.username}. They'll see it on their dashboard.` });
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-h5"><Users size={20} strokeWidth={1.8} className="text-steel" aria-hidden="true" />People on this case</h2>
          <p className="text-body-sm text-slate">Everyone here sees the whole case and everything anyone adds to it. What each person can add depends on their account type.</p>
        </div>
      </div>
      <ul className="divide-y divide-hairline-soft">
        <li className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-charcoal">
              {owner.name} {owner.username ? <span className="font-mono text-steel">@{owner.username}</span> : null}
            </p>
            <p className="text-caption text-steel">{ROLE_INFO.consignor.label} · owner</p>
          </div>
          <Tag tone="purple">Owner</Tag>
        </li>
        {list.map((m) => {
          const canRemove = (isOwner || m.invitedBy === viewer.id) && !m.id.startsWith("pending-");
          return (
            <li key={m.id} className="animate-rise flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-charcoal">
                  {m.name} <span className="font-mono text-steel">@{m.username}</span>
                  {m.userId === viewer.id ? <span className="text-steel"> (you)</span> : null}
                </p>
                <p className="text-caption text-steel">
                  {ROLE_INFO[m.role].label} · invited by @{m.inviterUsername} on {formatDate(m.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tag tone={m.status === "accepted" ? "green" : "orange"}>{m.status === "accepted" ? "Accepted" : "Invited"}</Tag>
                {canRemove ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run({ type: "remove", id: m.id }, () => removeMember(m.id))}
                    className="min-h-10 rounded-sm px-3 py-2 text-[14px] font-medium text-error transition-colors duration-150 active:bg-surface disabled:opacity-60"
                  >
                    {m.status === "pending" ? "Cancel invite" : "Remove"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {canInvite ? (
        <div className="mt-4 border-t border-hairline-soft pt-4">
          <InviteForm caseCode={caseCode} invitable={invitable} onInvite={invite} />
        </div>
      ) : (
        <p className="mt-4 border-t border-hairline-soft pt-4 text-body-sm text-steel">Your account type can&apos;t invite anyone to a case. You can view everything on it.</p>
      )}
    </Card>
  );
}
