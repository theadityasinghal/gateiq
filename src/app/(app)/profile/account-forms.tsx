"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, KeyRound, Mail, TriangleAlert, Trash2 } from "lucide-react";
import { changeEmail, changePassword, deleteAccount } from "@/server/onboarding/account";
import { authClient } from "@/lib/auth-client";
import { useOptimisticAction } from "@/lib/use-optimistic-action";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The email can change; the username (what people sign in with) can't. */
export function EmailCard({ email }: { email: string }) {
  const [value, setValue] = useState(email);
  const [error, setError] = useState<string | null>(null);
  const [shown, run, pending] = useOptimisticAction<string, string>(email, (_s, next) => next);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim().toLowerCase();
    if (!EMAIL_RE.test(next)) return setError("Enter a valid email address.");
    setError(null);
    if (next === shown) return;
    run(next, () => changeEmail(next), { success: "Email updated." });
  }

  return (
    <Card className="mt-10 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-h5"><Mail size={20} strokeWidth={1.8} className="text-steel" aria-hidden="true" />Email</h2>
        <p className="text-body-sm text-slate">
          Currently <span className="font-medium text-charcoal">{shown}</span>. It isn&apos;t used to sign in, so you can change it whenever you like.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="New email" htmlFor="new-email" error={error ?? undefined} className="flex-1">
          <Input id="new-email" type="email" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="email" required />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending || value.trim().toLowerCase() === shown} className="sm:mb-[22px]">Save email</Button>
      </form>
    </Card>
  );
}

/** A new password without the old one. The other devices are signed out; this one stays. */
export function PasswordCard() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [changed, run, pending] = useOptimisticAction<boolean, true>(false, () => true);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters for your password.");
    if (pw !== confirm) return setError("The two passwords don't match.");
    setError(null);
    const a = pw;
    const b = confirm;
    setPw("");
    setConfirm("");
    run(true, () => changePassword(a, b), { success: "Password changed. Your other devices were signed out." });
  }

  return (
    <Card className="mt-6 space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-h5"><KeyRound size={20} strokeWidth={1.8} className="text-steel" aria-hidden="true" />Password</h2>
        <p className="text-body-sm text-slate">Set a new password. You don&apos;t need the old one, and every other device is signed out.</p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="new-password" hint="At least 8 characters.">
          <Input id="new-password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-password" error={error ?? undefined}>
          <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button type="submit" variant="secondary" disabled={pending}>Change password</Button>
          {changed ? (
            <span role="status" className="flex items-center gap-1.5 text-body-sm text-tag-green-fg"><CircleCheck size={16} strokeWidth={1.8} aria-hidden="true" />Password updated</span>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

/** Deleting the account can't be undone, and the screen can't un-sign-you-out, so this one waits for the server. */
export function DeleteAccountCard({ username }: { username: string }) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const ready = typed.trim().replace(/^@/, "").toLowerCase() === username;

  async function onDelete() {
    setDeleting(true);
    try {
      const r = await deleteAccount(typed);
      if (!r.ok) {
        toast.error(r.error);
        setDeleting(false);
        return;
      }
      await authClient.signOut().catch(() => {});
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Something went wrong and your account was not deleted.");
      setDeleting(false);
    }
  }

  return (
    <Card className="mt-6 space-y-4 border-error/40">
      <div>
        <h2 className="flex items-center gap-2 text-h5 text-error"><Trash2 size={20} strokeWidth={1.8} aria-hidden="true" />Delete account</h2>
        <p className="text-body-sm text-slate">
          This deletes your account, every case you own with all its documents, and everything you added to other people&apos;s cases (documents, notes, verified values).
          Your username can&apos;t be used again by you. This can&apos;t be undone.
        </p>
      </div>
      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[14px] font-medium text-error">
          <TriangleAlert size={16} strokeWidth={1.8} aria-hidden="true" />
          I want to delete my account
        </summary>
        <div className="mt-4 space-y-3">
          <Field label={`Type your username (${username}) to confirm`} htmlFor="confirm-username">
            <Input id="confirm-username" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Button type="button" onClick={onDelete} disabled={!ready || deleting} className="!bg-error !text-on-primary disabled:!bg-hairline disabled:!text-muted">
            {deleting ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
      </details>
    </Card>
  );
}
