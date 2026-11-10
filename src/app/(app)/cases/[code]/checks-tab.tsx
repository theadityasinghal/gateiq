import type { CheckReport, CheckResult, CheckStatus } from "@/lib/checks/types";
import { ROLE_INFO } from "@/lib/roles";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import { AckForm } from "./ack-form";

const STATUS: Record<CheckStatus, { label: string; tone: "red" | "orange" | "green" | "gray" }> = {
  mismatch: { label: "Mismatch", tone: "red" },
  invalid: { label: "Wrong on its own", tone: "red" },
  warning: { label: "Worth a look", tone: "orange" },
  agree: { label: "Agrees", tone: "green" },
  single: { label: "One source", tone: "gray" },
};

const isIssue = (r: CheckResult) => r.status === "mismatch" || r.status === "invalid" || r.status === "warning";
const RANK: Record<CheckStatus, number> = { invalid: 0, mismatch: 1, warning: 2, single: 3, agree: 4 };

/**
 * Where the documents on the case agree and where they don't, per container and for the case as a whole.
 * Nothing here says which document is right: it shows who said what, and who can fix or explain it.
 */
export function ChecksTab({ caseCode, report }: { caseCode: string; report: CheckReport }) {
  const { counts } = report;
  const open = counts.mismatch + counts.invalid;
  const hasAnything = report.containers.length > 0 || report.caseChecks.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h5">Cross-document checks</h2>
          {open ? <Tag tone="red">{open} to fix</Tag> : null}
          {counts.warning ? <Tag tone="orange">{counts.warning} worth a look</Tag> : null}
          {counts.acknowledged ? <Tag tone="gray">{counts.acknowledged} explained</Tag> : null}
          {hasAnything && !open && !counts.warning ? <Tag tone="green">No open issues</Tag> : null}
        </div>
        <p className="mt-2 max-w-[720px] text-body-sm text-slate">
          Every document on the case is compared with the others and with what was declared when the case was created. None is
          treated as the right one: a mismatch shows who said what. Whoever added a document can correct it; anyone on the case can
          explain a mismatch that is expected.
        </p>
        {!hasAnything ? <p className="mt-4 text-body-sm text-steel">Nothing to compare yet. Add documents on the Documents tab.</p> : null}
      </Card>

      {report.containers.map((c) => (
        <Section
          key={c.id}
          caseCode={caseCode}
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-micro-upper text-steel">Container</span>
              <span className="font-mono text-h5">{c.label}</span>
            </span>
          }
          results={c.results}
        />
      ))}

      {report.caseChecks.length ? <Section caseCode={caseCode} title={<span className="text-h5">Whole consignment</span>} results={report.caseChecks} /> : null}
    </div>
  );
}

function Section({ caseCode, title, results }: { caseCode: string; title: React.ReactNode; results: CheckResult[] }) {
  const sorted = [...results].sort((a, b) => RANK[a.status] - RANK[b.status]);
  const issues = sorted.filter((r) => isIssue(r));
  const rest = sorted.filter((r) => !isIssue(r));
  return (
    <Card>
      <h3>{title}</h3>
      {issues.length ? (
        <ul className="mt-4 divide-y divide-hairline-soft">
          {issues.map((r) => (
            <ResultRow key={r.key} caseCode={caseCode} r={r} />
          ))}
        </ul>
      ) : null}
      {rest.length ? (
        <details className="mt-4 rounded-lg bg-surface p-4" open={!issues.length}>
          <summary className="cursor-pointer text-body-sm font-medium text-charcoal">
            {rest.filter((r) => r.status === "agree").length} agree · {rest.filter((r) => r.status === "single").length} with one source so far
          </summary>
          <ul className="mt-3 divide-y divide-hairline-soft">
            {rest.map((r) => (
              <ResultRow key={r.key} caseCode={caseCode} r={r} compact />
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function ResultRow({ caseCode, r, compact = false }: { caseCode: string; r: CheckResult; compact?: boolean }) {
  const st = STATUS[r.status];
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        {r.acknowledged ? <Tag tone="gray">Explained</Tag> : <Tag tone={st.tone}>{st.label}</Tag>}
        <span className="text-[15px] font-semibold text-charcoal">{r.label}</span>
      </div>
      {!compact || r.groups.length > 1 ? <p className="mt-1 text-body-sm text-slate">{r.message}</p> : null}
      {r.groups.length ? (
        <ul className="mt-3 space-y-2">
          {r.groups.map((g, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[15px] text-ink">{g.display}</span>
              <span className="flex flex-wrap gap-1.5">
                {g.sources.map((s) => (
                  <span key={s.submissionId ?? "case"} className="text-caption text-steel">
                    <span className="rounded-sm bg-tint-gray px-1.5 py-0.5 font-mono text-slate">{s.label}</span> {ROLE_INFO[s.role].label} · {s.adderName}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {isIssue(r) && !r.acknowledged && r.owners.length ? (
        <p className="mt-2 text-caption text-steel">Can fix: {r.owners.map((o) => ROLE_INFO[o].label).join(", ")}</p>
      ) : null}
      {r.acknowledged ? (
        <p className="mt-2 rounded-md bg-surface p-3 text-body-sm text-slate">
          <span className="font-medium text-charcoal">{r.acknowledged.byName}</span> explained on {formatDateTime(r.acknowledged.at)}: {r.acknowledged.note}
        </p>
      ) : isIssue(r) ? (
        <AckForm caseCode={caseCode} checkKey={r.key} valuesKey={r.valuesKey} />
      ) : null}
    </li>
  );
}
