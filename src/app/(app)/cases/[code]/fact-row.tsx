"use client";

import { Check, Eraser, ShieldCheck, TriangleAlert } from "lucide-react";
import { confirmFact, retireFact } from "@/server/cases/facts";
import { useOptimisticAction } from "@/lib/use-optimistic-action";
import type { FactSummary, RowGroup, VerifiedRowData } from "@/lib/facts/rows";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { LevelBadge } from "@/components/fact-level-badge";
import { cn } from "@/lib/cn";

type Me = { id: string; name: string; role: Role };
type Act = { type: "confirm"; me: Me } | { type: "set"; display: string; me: Me } | { type: "retire" };

function reduce(state: FactSummary | null, a: Act): FactSummary | null {
  if (a.type === "retire") return null;
  if (a.type === "set") {
    return { id: "pending", display: a.display, level: "declared", setByName: a.me.name, setByRole: a.me.role, setAt: new Date(), confirmations: [] };
  }
  if (!state) return state;
  const confirmations = [...state.confirmations, { name: a.me.name, role: a.me.role }];
  // One agreeing account in a different role lifts a declared value to confirmed.
  const level = state.level === "declared" && a.me.role !== state.setByRole ? "confirmed" : state.level;
  return { ...state, confirmations, level };
}

const btn = "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-caption font-medium transition-colors duration-150 hover:bg-canvas disabled:opacity-60";

/** One verified fact: its value and place on the ladder, the values the documents give, and one-tap actions that update at once. */
export function FactRow({ caseCode, row, me }: { caseCode: string; row: VerifiedRowData; me: Me }) {
  const [fact, run, pending] = useOptimisticAction<FactSummary | null, Act>(row.fact, reduce);

  const tap = (g: RowGroup) => {
    const a = g.action.kind;
    if (a === "none") return;
    run(a === "confirm" ? { type: "confirm", me } : { type: "set", display: g.display, me }, () => confirmFact(caseCode, { factKey: row.factKey, scope: row.scope, display: g.display }));
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[15px] font-semibold text-charcoal">{row.label}</p>
          {fact ? (
            <>
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[16px] text-ink">{fact.display}</span>
                <LevelBadge level={fact.level} />
              </p>
              <p className="text-caption text-steel">
                Put forward by {fact.setByName} ({ROLE_INFO[fact.setByRole].label})
                {fact.confirmations.length ? ` · agreed by ${fact.confirmations.map((c) => `${c.name} (${ROLE_INFO[c.role].label})`).join(", ")}` : " · nobody else has agreed yet"}
              </p>
            </>
          ) : (
            <p className="text-body-sm text-steel">Not verified yet. Confirm one of the values below to start.</p>
          )}
        </div>
        {fact && row.canWithdraw && fact.id !== "pending" ? (
          <button
            type="button"
            disabled={pending}
            title="Withdraw the verified value. Documents go back to being compared with each other."
            onClick={() => run({ type: "retire" }, () => retireFact(caseCode, fact.id))}
            className={cn(btn, "text-steel hover:text-error")}
          >
            <Eraser size={14} strokeWidth={1.8} aria-hidden="true" />
            Withdraw
          </button>
        ) : null}
      </div>

      {row.groups.length ? (
        <ul className="mt-3 space-y-2 rounded-lg bg-surface p-3">
          {row.groups.map((g) => {
            const matches = fact ? g.display === fact.display || g.matches === true : null;
            return (
              <li key={g.display} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {matches === true ? (
                  <Check size={15} strokeWidth={2.4} className="text-tag-green-fg" aria-label="Matches the verified value" role="img" />
                ) : matches === false ? (
                  <TriangleAlert size={15} strokeWidth={1.8} className="text-warning" aria-label="Differs from the verified value" role="img" />
                ) : null}
                <span className="font-mono text-[15px] text-ink">{g.display}</span>
                {g.sources.map((s) => (
                  <span key={s.label} title={`${s.roleLabel} · ${s.adderName}`} className="rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-caption text-slate">
                    {s.label}
                  </span>
                ))}
                {g.action.kind !== "none" && !(fact && matches && g.action.kind !== "confirm") ? (
                  <button type="button" disabled={pending} onClick={() => tap(g)} className={cn(btn, "text-link-blue")} title="Agree, or put this value forward">
                    <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
                    {g.action.kind === "confirm" ? "Confirm" : g.action.kind === "replace" ? "Use this instead" : "Confirm this value"}
                  </button>
                ) : g.action.kind === "none" && g.action.reason ? (
                  <span className="text-caption text-stone">{g.action.reason}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-caption text-stone">No document gives this value now.</p>
      )}
    </li>
  );
}
