"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "./button";

/** A submit button for a plain `<form action>`: disabled with a spinner and `pendingLabel` while the action runs. */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} aria-busy={pending} {...props}>
      {pending ? <LoaderCircle size={16} strokeWidth={2} className="animate-spin" aria-hidden="true" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
