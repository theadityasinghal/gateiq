"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { acknowledgeCheck } from "@/server/cases/submissions";
import { useOptimisticAction } from "@/lib/use-optimistic-action";

/**
 * "This is expected, because…": records a note against one exact disagreement. The note shows at once; if the
 * server refuses it, the form comes back with what was typed and a message says why.
 */
export function AckForm({ caseCode, checkKey, valuesKey, byName }: { caseCode: string; checkKey: string; valuesKey: string; byName: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, run] = useOptimisticAction<string | null, string>(null, (_s, note) => note);
  const id = `ack-${checkKey}`;

  if (saved) {
    return (
      <p className="animate-rise rounded-md bg-surface p-3 text-body-sm text-slate">
        <span className="font-medium text-charcoal">{byName}:</span> {saved}
      </p>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const note = text.trim();
    if (note.length < 5) return setError("Say briefly why this is fine (at least a few words).");
    setError(null);
    run(note, () => acknowledgeCheck(caseCode, checkKey, valuesKey, note));
  }

  return (
    <details>
      <summary
        className="inline-flex cursor-pointer list-none items-center gap-1.5 text-caption font-medium text-link-blue"
        title="It's expected: say why. The note lapses if the values change."
      >
        <MessageSquareText size={14} strokeWidth={1.8} aria-hidden="true" />
        Explain
      </summary>
      <form onSubmit={onSubmit} className="mt-2 space-y-2">
        <label htmlFor={id} className="sr-only">Why this is fine</label>
        <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="e.g. Truck changed at Bhiwandi after a breakdown; Part B updated." />
        {error ? <p role="alert" className="text-caption text-error">{error}</p> : null}
        <Button type="submit" variant="secondary">Save</Button>
      </form>
    </details>
  );
}
