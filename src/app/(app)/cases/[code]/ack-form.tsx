"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { acknowledgeCheck } from "@/server/cases/submissions";

/** "This is expected, because…": records a note against one exact disagreement. */
export function AckForm({ caseCode, checkKey, valuesKey }: { caseCode: string; checkKey: string; valuesKey: string }) {
  const [state, action, pending] = useActionState(acknowledgeCheck.bind(null, caseCode), {});
  const id = `ack-${checkKey}`;
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-body-sm font-medium text-link-blue">It&apos;s expected: explain why</summary>
      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="checkKey" value={checkKey} />
        <input type="hidden" name="valuesKey" value={valuesKey} />
        <label htmlFor={id} className="sr-only">Why this is fine</label>
        <Textarea id={id} name="note" maxLength={500} placeholder="e.g. Truck changed at Bhiwandi after a breakdown; Part B was updated." />
        {state.error ? <p role="alert" className="text-caption text-error">{state.error}</p> : null}
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save explanation"}</Button>
      </form>
    </details>
  );
}
