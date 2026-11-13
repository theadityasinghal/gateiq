import { removeMember } from "@/server/cases/members";
import type { CaseMemberRow } from "@/server/cases/service";
import { ROLE_INFO } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { InviteForm } from "./invite-form";

/** Everyone on a case, who invited them, and (for those who may invite) the form to add someone. */
export function PeopleCard({
  caseCode,
  viewerId,
  isOwner,
  owner,
  members,
  canInvite,
  invitable,
}: {
  caseCode: string;
  viewerId: string;
  isOwner: boolean;
  owner: { name: string; username: string | null };
  members: CaseMemberRow[];
  canInvite: boolean;
  invitable: string[];
}) {
  return (
    <Card className="animate-rise">
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
        {members.map((m) => {
          const canRemove = isOwner || m.invitedBy === viewerId;
          return (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-charcoal">
                  {m.name} <span className="font-mono text-steel">@{m.username}</span>
                  {m.userId === viewerId ? <span className="text-steel"> (you)</span> : null}
                </p>
                <p className="text-caption text-steel">
                  {ROLE_INFO[m.role].label} · invited by @{m.inviterUsername} on {formatDate(m.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tag tone={m.status === "accepted" ? "green" : "orange"}>{m.status === "accepted" ? "Accepted" : "Invited"}</Tag>
                {canRemove ? (
                  <form action={removeMember}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <button type="submit" className="min-h-10 rounded-sm px-3 py-2 text-[14px] font-medium text-error transition-colors duration-150 active:bg-surface">
                      {m.status === "pending" ? "Cancel invite" : "Remove"}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {canInvite ? (
        <div className="mt-4 border-t border-hairline-soft pt-4">
          <InviteForm caseCode={caseCode} invitable={invitable} />
        </div>
      ) : (
        <p className="mt-4 border-t border-hairline-soft pt-4 text-body-sm text-steel">Your account type can&apos;t invite anyone to a case.</p>
      )}
    </Card>
  );
}
