"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * Asks why a value is being replaced before the replace goes through. The reason stays with the new value
 * and in the activity log, so whoever set or agreed with the old value can see what happened and why.
 */
export function ReplaceReason({ id, onSubmit, onCancel }: { id: string; onSubmit: (reason: string) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-2 flex w-full flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const reason = text.trim();
        if (reason.length < 5) return setError("Say briefly why (at least a few words).");
        setError(null);
        onSubmit(reason);
      }}
    >
      <label htmlFor={id} className="sr-only">
        Why replace this value
      </label>
      <div className="min-w-0 flex-1 basis-56">
        <Input id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Why? e.g. The SB was amended on 12 Nov." autoFocus />
        {error ? (
          <p role="alert" className="mt-1 text-caption text-error">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="secondary">
        Replace
      </Button>
      <button type="button" onClick={onCancel} className="px-2 py-2 text-caption font-medium text-steel hover:text-ink">
        Cancel
      </button>
    </form>
  );
}
