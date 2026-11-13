import { Check, Clock } from "lucide-react";
import type { FlowStep, StepState } from "@/lib/case-flow";
import { cn } from "@/lib/cn";

const BAR: Record<StepState, string> = {
  done: "bg-tag-green-fg",
  current: "bg-primary",
  todo: "bg-hairline-strong",
  later: "bg-hairline",
};
const STATE_WORD: Record<StepState, string> = { done: "Done", current: "In progress", todo: "Not started", later: "Not live yet" };

/**
 * A case's stages as a row of segments. The compact form (dashboard rows) names only the step in progress;
 * the full form (case page) names every step with its detail.
 */
export function FlowStrip({ steps, compact = false }: { steps: FlowStep[]; compact?: boolean }) {
  const current = steps.find((s) => s.state === "current");
  const allDone = steps.filter((s) => s.key !== "gate").every((s) => s.state === "done");
  return (
    <div>
      <ol className={cn("grid gap-1.5", compact ? "min-w-[180px]" : "")} style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <li key={s.key} title={`${s.label}: ${STATE_WORD[s.state]}${s.detail ? ` · ${s.detail}` : ""}`} className="min-w-0">
            <span className={cn("animate-grow-x block h-1.5 rounded-full transition-colors duration-500", BAR[s.state])} style={{ animationDelay: `${i * 80}ms` }} />
            {compact ? null : (
              <span className="mt-2 flex items-start gap-1 text-caption">
                {s.state === "done" ? <Check size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-tag-green-fg" aria-hidden="true" /> : null}
                {s.state === "later" ? <Clock size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-stone" aria-hidden="true" /> : null}
                <span className="min-w-0">
                  <span className={cn("block truncate", s.state === "current" ? "font-semibold text-ink" : s.state === "todo" || s.state === "later" ? "text-stone" : "text-charcoal")}>{s.label}</span>
                  {s.detail ? <span className="block truncate text-stone">{s.detail}</span> : null}
                </span>
                <span className="sr-only">{STATE_WORD[s.state]}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
      {compact ? (
        <p className="mt-1.5 text-caption text-steel">
          {current ? (
            <>
              <span className="font-medium text-charcoal">{current.label}</span>
              {current.detail ? ` · ${current.detail}` : ""}
            </>
          ) : allDone ? (
            <span className="font-medium text-tag-green-fg">Ready for the gate stage</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
