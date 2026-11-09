"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { findInvitee, inviteToCase, type Invitee } from "@/server/cases/members";
import { USERNAME_MAX } from "@/lib/username";

/** Exact-username lookup first, so the inviter sees the name and account type before sending. */
export function InviteForm({ caseCode, invitable }: { caseCode: string; invitable: string[] }) {
  const [username, setUsername] = useState("");
  const [found, setFound] = useState<Invitee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onFind(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(null);
    setFound(null);
    start(async () => {
      const r = await findInvitee(caseCode, username);
      if (r.ok) setFound(r.invitee);
      else setError(r.error);
    });
  }

  function onSend() {
    if (!found) return;
    setError(null);
    start(async () => {
      const r = await inviteToCase(caseCode, found.username);
      if (r.ok) {
        setSent(`Invite sent to @${r.invitee.username}. They'll see it on their dashboard.`);
        setFound(null);
        setUsername("");
      } else {
        setError(r.error);
        setFound(null);
      }
    });
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
          {pending && !found ? "Finding…" : "Find"}
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
            <Button type="button" onClick={onSend} disabled={pending}>{pending ? "Sending…" : "Send invite"}</Button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-body-sm text-error">{error}</p> : null}
      {sent ? <p role="status" className="text-body-sm text-tag-green-fg">{sent}</p> : null}
    </div>
  );
}
