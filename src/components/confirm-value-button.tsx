"use client";

import { Check, Info, ShieldCheck } from "lucide-react";
import { confirmFact } from "@/server/cases/facts";
import { useOptimisticAction } from "@/lib/use-optimistic-action";
import type { GroupAction } from "@/lib/facts/ladder";
import { cn } from "@/lib/cn";

const LABEL = { confirm: "Confirm", declare: "Confirm this value", replace: "Use this instead" } as const;
const TITLE = {
  confirm: "Agree with the verified value. It becomes confirmed once someone in a different role has done so.",
  declare: "Put this value forward as the verified value for the case. Someone in another role then confirms it.",
  replace: "Make this the verified value instead of the current one.",
} as const;

/**
 * One tap to confirm a value. The screen shows it confirmed at once; if the server refuses, it goes back and
 * a message says why. The value itself is looked up on the server, never taken from here.
 */
export function ConfirmValueButton({
  caseCode,
  factKey,
  scope,
  display,
  action,
  quiet = false,
}: {
  caseCode: string;
  factKey: string;
  scope: string;
  display: string;
  action: GroupAction;
  /** Show nothing (instead of an info icon) when the viewer can't act. */
  quiet?: boolean;
}) {
  const [done, run, pending] = useOptimisticAction<boolean, true>(false, () => true);
  if (action.kind === "none") {
    return action.reason && !quiet ? (
      <span title={action.reason} className="inline-flex text-stone">
        <Info size={14} strokeWidth={1.8} aria-label={action.reason} role="img" />
      </span>
    ) : null;
  }
  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-caption font-medium text-tag-green-fg">
        <Check size={14} strokeWidth={2.4} aria-hidden="true" />
        {action.kind === "confirm" ? "Confirmed" : "Verified"}
      </span>
    );
  }
  return (
    <button
      type="button"
      title={TITLE[action.kind]}
      disabled={pending}
      onClick={() => run(true, () => confirmFact(caseCode, { factKey, scope, display }))}
      className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-caption font-medium text-link-blue transition-colors duration-150 hover:bg-surface disabled:opacity-60")}
    >
      <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
      {LABEL[action.kind]}
    </button>
  );
}
