"use client";

import { useActionState, useState } from "react";
import type { Role } from "@/lib/roles";
import { changeRole, type FormState } from "@/server/onboarding/actions";
import { Field, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Option = { role: Role; label: string; lost: string[] };

export function RoleChangeForm({ options }: { options: Option[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeRole, {});
  const [role, setRole] = useState<Role | "">("");
  const [confirmed, setConfirmed] = useState(false);
  const selected = options.find((o) => o.role === role);

  return (
    <form action={action} className="space-y-4">
      <Field label="New account type" htmlFor="role">
        <Select id="role" name="role" value={role} onChange={(e) => { setRole(e.target.value as Role); setConfirmed(false); }}>
          <option value="" disabled>Choose an account type</option>
          {options.map((o) => (
            <option key={o.role} value={o.role}>{o.label}</option>
          ))}
        </Select>
      </Field>

      {selected ? (
        <div className="rounded-lg bg-tag-red-bg p-4 text-body-sm text-tag-red-fg">
          {selected.lost.length ? (
            <>
              <p className="font-medium">Switching to {selected.label} deletes:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {selected.lost.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </>
          ) : (
            <p>Nothing specific to your current account type needs deleting.</p>
          )}
          <label className="mt-3 flex items-start gap-2">
            <input type="checkbox" name="confirm" value="yes" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
            <span>I understand this can&apos;t be undone.</span>
          </label>
        </div>
      ) : null}

      {state.error ? <p role="alert" className="text-body-sm text-error">{state.error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={!selected || !confirmed || pending}>
          {pending ? "Changing…" : "Change account type"}
        </Button>
      </div>
    </form>
  );
}
