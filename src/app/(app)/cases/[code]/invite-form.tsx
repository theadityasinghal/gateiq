"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { findInvitee, type Invitee } from "@/server/cases/members";
import { USERNAME_MAX } from "@/lib/username";
import { CircleX, Search, Send } from "lucide-react";

/** Exact-username lookup first, so the inviter sees the name and account type before sending. */
export function InviteForm({ caseCode, invitable, onInvite }: { caseCode: string; invitable: string[]; onInvite: (who: Invitee) => void }) {
  const [username, setUsername] = useState("");
  const [found, setFound] = useState<Invitee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onFind(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFound(null);
    start(async () => {
      const r = await findInvitee(caseCode, username);
      if (r.ok) setFound(r.invitee);
      else setError(r.error);
    });
  }

  // The invite shows in the list at once; the people list rolls it back with a message if the server refuses.
  function onSend() {
    if (!found) return;
    onInvite(found);
    setFound(null);
    setUsername("");
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onFind} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label="Invite by username"
          htmlFor="invite-username"
          hint={`You can invite a ${invitable.join(" or ")}. Type their exact username.`}
          className="flex-1"
        >
          <Input
            id="invite-username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setFound(null);
              setError(null);
            }}
            placeholder="@username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={USERNAME_MAX + 1}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending || !username.trim()} className="sm:mb-[22px]">
          <Search size={16} strokeWidth={1.8} aria-hidden="true" />{pending && !found ? "Finding…" : "Find"}
        </Button>
      </form>

      {found ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-charcoal">
              {found.name} <span className="font-mono text-steel">@{found.username}</span>
            </p>
            <p className="text-caption text-steel">{found.roleLabel}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setFound(null)} disabled={pending}>Cancel</Button>
            <Button type="button" onClick={onSend}><Send size={16} strokeWidth={1.8} aria-hidden="true" />Send invite</Button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="flex items-center gap-1.5 text-body-sm text-error"><CircleX size={16} strokeWidth={1.8} aria-hidden="true" />{error}</p> : null}
    </div>
  );
}
