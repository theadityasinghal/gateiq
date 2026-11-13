import { Container, ListChecks } from "lucide-react";
import type { VerifiedSectionData } from "@/lib/facts/rows";
import { FACT_LEVELS, FACT_LEVEL_HELP, FACT_LEVEL_LABEL, type FactLevel } from "@/lib/facts/ladder";
import type { Role } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { LEVEL_ICON } from "@/components/fact-level-badge";
import { FactRow } from "./fact-row";

const LIVE: FactLevel[] = ["declared", "confirmed"];

/**
 * The base of the case: the values everyone agrees to treat as true. Documents are checked against these first.
 * A value climbs one rung when someone in a different role confirms it; the later rungs aren't live yet.
 */
export function VerifiedPanel({ caseCode, sections, me, readOnly }: { caseCode: string; sections: VerifiedSectionData[]; me: { id: string; name: string; role: Role }; readOnly: boolean }) {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-1 text-h5">Verified info</h2>
        <p className="text-body-sm text-slate">
          What the case treats as true. Every document is compared with these values first; where nothing is verified yet, documents are compared with each other.
          Nobody can confirm their own value, and a value only counts as confirmed when someone in a different role agrees.
          {readOnly ? " Your account type can view this but not change it." : ""}
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-4">
          {FACT_LEVELS.map((l, i) => {
            const Icon = LEVEL_ICON[l];
            const live = LIVE.includes(l);
            return (
              <li key={l} className="flex items-start gap-2.5 rounded-lg bg-surface p-3">
                <Icon size={18} strokeWidth={1.8} className={live ? "mt-0.5 shrink-0 text-ink" : "mt-0.5 shrink-0 text-stone"} aria-hidden="true" />
                <div className="min-w-0">
                  <p className={live ? "text-[14px] font-medium text-charcoal" : "text-[14px] font-medium text-stone"}>
                    {i + 1}. {FACT_LEVEL_LABEL[l]}
                  </p>
                  <p className="text-caption text-steel">{FACT_LEVEL_HELP[l]}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {sections.length ? (
        sections.map((s) => (
          <Card key={s.id}>
            <h3 className="flex items-center gap-2">
              {s.container ? <Container size={18} strokeWidth={1.8} className="text-steel" aria-label="Container" role="img" /> : <ListChecks size={18} strokeWidth={1.8} className="text-steel" aria-hidden="true" />}
              <span className={s.container ? "font-mono text-h5" : "text-h5"}>{s.title}</span>
            </h3>
            <ul className="mt-1 divide-y divide-hairline-soft">
              {s.rows.map((r) => (
                <FactRow key={r.id} caseCode={caseCode} row={r} me={me} />
              ))}
            </ul>
          </Card>
        ))
      ) : (
        <p className="rounded-lg bg-surface p-6 text-body-sm text-slate">Nothing to verify yet. Add documents, and their values will appear here.</p>
      )}
    </div>
  );
}
