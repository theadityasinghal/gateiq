"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Trash } from "lucide-react";
import { removeSubmission } from "@/server/cases/submissions";
import { useOptimisticAction } from "@/lib/use-optimistic-action";
import { DOC_TYPES, DOC_TYPE_KEYS, type DocType } from "@/lib/documents";
import { DocIcon } from "@/components/doc-icon";
import { iconButtonClass } from "@/components/ui/status";

export type SubmissionItem = { id: string; type: DocType; node: ReactNode };

const RemoveContext = createContext<(id: string) => void>(() => {});

/**
 * The documents grouped by type. Removing one makes it vanish at once; if the server refuses, it comes back
 * with a message. The cards themselves are rendered on the server and passed in.
 */
export function SubmissionList({ items }: { items: SubmissionItem[] }) {
  const [shown, run] = useOptimisticAction(items, (list: SubmissionItem[], id: string) => list.filter((i) => i.id !== id));
  const remove = (id: string) => run(id, () => removeSubmission(id));

  const byType = new Map<DocType, SubmissionItem[]>();
  for (const i of shown) byType.set(i.type, [...(byType.get(i.type) ?? []), i]);
  const types = DOC_TYPE_KEYS.filter((t) => byType.has(t));
  if (!types.length) return <p className="rounded-lg bg-surface p-6 text-body-sm text-slate">No documents yet.</p>;

  return (
    <RemoveContext.Provider value={remove}>
      {types.map((t) => {
        const list = byType.get(t)!;
        return (
          <section key={t} className="space-y-3">
            <h2 className="flex items-center gap-2 text-h5">
              <DocIcon type={t} size={20} className="text-steel" />
              {DOC_TYPES[t].label}
              {list.length > 1 ? <span className="text-body-sm font-normal text-stone" title="Copies from different people are compared with each other">×{list.length}</span> : null}
            </h2>
            {list.map((i) => (
              <div key={i.id}>{i.node}</div>
            ))}
          </section>
        );
      })}
    </RemoveContext.Provider>
  );
}

export function RemoveSubmissionButton({ id }: { id: string }) {
  const remove = useContext(RemoveContext);
  return (
    <button type="button" onClick={() => remove(id)} className={iconButtonClass("danger")} title="Remove" aria-label="Remove">
      <Trash size={17} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
