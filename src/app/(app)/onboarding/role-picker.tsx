"use client";

import { useActionState, useState } from "react";
import { ROLES, ROLE_INFO, type Role } from "@/lib/roles";
import { tintBg } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { chooseRole, type FormState } from "@/server/onboarding/actions";
import { cn } from "@/lib/cn";

export function RolePicker({ current }: { current: Role | null }) {
  const [selected, setSelected] = useState<Role | null>(current);
  const [state, action, pending] = useActionState<FormState, FormData>(chooseRole, {});

  return (
    <form action={action} className="mt-8">
      <fieldset>
        <legend className="sr-only">Account type</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role) => {
            const info = ROLE_INFO[role];
            const checked = selected === role;
            return (
              <label
                key={role}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-lg p-6 text-charcoal transition-shadow",
                  tintBg[info.tint],
                  checked ? "ring-2 ring-primary shadow-card" : "ring-1 ring-transparent",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={checked}
                  onChange={() => setSelected(role)}
                  className="sr-only"
                />
                <span className="flex items-start justify-between gap-2">
                  <span className="text-h5">{info.label}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                      checked ? "border-primary bg-primary" : "border-hairline-strong bg-canvas",
                    )}
                  >
                    {checked ? <span className="h-2 w-2 rounded-full bg-on-primary" /> : null}
                  </span>
                </span>
                <span className="text-body-sm">{info.blurb}</span>
                {info.official ? (
                  <span>
                    <Tag tone="gray">Official role</Tag>
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      {state.error ? (
        <p role="alert" className="mt-4 text-body-sm text-error">
          {state.error}
        </p>
      ) : null}
      <div className="mt-8 flex justify-end">
        <Button type="submit" disabled={!selected || pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </div>
    </form>
  );
}
