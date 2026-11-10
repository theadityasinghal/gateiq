"use client";

import { useActionState } from "react";
import { MessageSquareText } from "lucide-react";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { acknowledgeCheck } from "@/server/cases/submissions";

/** "This is expected, because…": records a note against one exact disagreement. */
export function AckForm({ caseCode, checkKey, valuesKey }: { caseCode: string; checkKey: string; valuesKey: string }) {
  const [state, action, pending] = useActionState(acknowledgeCheck.bind(null, caseCode), {});
  const id = `ack-${checkKey}`;
  return (
    <details>
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1.5 text-caption font-medium text-link-blue"
        title="It's expected: say why. The note lapses if the values change."
      >
        <MessageSquareText size={14} strokeWidth={1.8} aria-hidden="true" />
        Explain
      </summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="checkKey" value={checkKey} />
        <input type="hidden" name="valuesKey" value={valuesKey} />
        <label htmlFor={id} className="sr-only">Why this is fine</label>
        <Textarea id={id} name="note" maxLength={500} placeholder="e.g. Truck changed at Bhiwandi after a breakdown; Part B updated." />
        {state.error ? <p role="alert" className="text-caption text-error">{state.error}</p> : null}
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </form>
    </details>
  );
}
