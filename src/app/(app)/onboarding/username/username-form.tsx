"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { chooseUsername } from "@/server/onboarding/username";
import type { FormState } from "@/server/onboarding/actions";
import { USERNAME_MAX } from "@/lib/username";

export function UsernameForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(chooseUsername, {});
  return (
    <form action={action} className="mt-8 space-y-4">
      <Field
        label="Username"
        htmlFor="username"
        error={state.error}
        hint="3 to 30 characters: letters, numbers, dots and underscores, starting with a letter."
      >
        <Input
          id="username"
          name="username"
          defaultValue={state.values?.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={USERNAME_MAX + 1}
          aria-invalid={state.error ? true : undefined}
          required
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save username"}</Button>
      </div>
    </form>
  );
}
