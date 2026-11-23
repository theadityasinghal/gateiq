import { Container, Layers, Wrench } from "lucide-react";
import type { CheckReport, CheckResult, CheckStatus } from "@/lib/checks/types";
import { FACTS } from "@/lib/checks/facts";
import { ROLE_INFO, isReadOnly, type Role } from "@/lib/roles";
import { FACT_LEVELS, FACT_LEVEL_HELP, groupAction, isVerifiable, type FactView } from "@/lib/facts/ladder";
import { LevelBadge } from "@/components/fact-level-badge";
import { ConfirmValueButton } from "@/components/confirm-value-button";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { StatusCount, StatusTag } from "@/components/ui/status";
import { AckForm } from "./ack-form";

const isIssue = (r: CheckResult) => r.status === "mismatch" || r.status === "invalid" || r.status === "warning";
const RANK: Record<CheckStatus, number> = { invalid: 0, mismatch: 1, warning: 2, single: 3, agree: 4 };

/** A plain mismatch is already said by the values listed under it; only other results need their message. */
const showMessage = (r: CheckResult) => !(r.status === "mismatch" && r.fact in FACTS) && r.status !== "agree" && r.status !== "single";

/** One line saying what this row's status means, in plain words. */
function summaryLine(r: CheckResult): string {
  if (r.acknowledged) return "Someone explained the difference.";
  if (r.status === "agree") return r.verified ? "Every document matches the verified value." : "Every document says the same.";
  if (r.status === "single") return "Only one document mentions this, so there is nothing to compare it with yet.";
  if (r.verified && (r.status === "mismatch" || r.status === "invalid")) return "Some documents don't match the verified value.";
  return "";
}

type Viewer = { id: string; role: Role; name: string };

/**
 * Where the documents on the case agree and where they don't, per container and for the case as a whole.
 * Nothing here says which document is right: it shows who said what, and who can fix or explain it.
 */
export function ChecksTab({ caseCode, report, viewer, facts }: { caseCode: string; report: CheckReport; viewer: Viewer; facts: FactView[] }) {
  const { counts } = report;
  const hasAnything = report.containers.length > 0 || report.caseChecks.length > 0;
  const clean = hasAnything && !counts.mismatch && !counts.invalid && !counts.warning;

  return (
    <div className="animate-rise space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-h5">Checks</h2>
          <StatusCount kind="mismatch" n={counts.mismatch + counts.invalid} />
          <StatusCount kind="warning" n={counts.warning} />
          <StatusCount kind="explained" n={counts.acknowledged} />
          {clean ? <StatusTag kind="agree" label="Everything matches" /> : null}
        </div>
        <Legend />
      </div>

      {!hasAnything ? <p className="rounded-lg bg-surface p-6 text-body-sm text-slate">Nothing to compare yet.</p> : null}

      {report.containers.map((c) => (
        <Section
          key={c.id}
          caseCode={caseCode}
          viewer={viewer}
          facts={facts}
          title={
            <span className="flex items-center gap-2">
              <Container size={18} strokeWidth={1.8} className="text-steel" aria-label="Container" role="img" />
              <span className="font-mono text-h5">{c.label}</span>
            </span>
          }
          results={c.results}
        />
      ))}

      {report.caseChecks.length ? (
        <Section
          caseCode={caseCode}
          viewer={viewer}
          facts={facts}
          title={
            <span className="flex items-center gap-2">
              <Layers size={18} strokeWidth={1.8} className="text-steel" aria-hidden="true" />
              <span className="text-h5">Consignment</span>
            </span>
          }
          results={report.caseChecks}
        />
      ) : null}
    </div>
  );
}

function Section({ caseCode, title, results, viewer, facts }: { caseCode: string; title: React.ReactNode; results: CheckResult[]; viewer: Viewer; facts: FactView[] }) {
  const sorted = [...results].sort((a, b) => RANK[a.status] - RANK[b.status]);
  const issues = sorted.filter(isIssue);
  const rest = sorted.filter((r) => !isIssue(r));
  const agree = rest.filter((r) => r.status === "agree").length;
  const single = rest.length - agree;
  return (
    <Card>
      <h3>{title}</h3>
      {issues.length ? (
        <ul className="mt-3 divide-y divide-hairline-soft">
          {issues.map((r) => (
            <ResultRow key={r.key} caseCode={caseCode} r={r} viewer={viewer} facts={facts} />
          ))}
        </ul>
      ) : null}
      {rest.length ? (
        <details className="group mt-3" open={!issues.length}>
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md py-2 text-body-sm">
            <span className="text-caption font-medium uppercase tracking-wide text-steel">Passed</span>
            <StatusCount kind="agree" n={agree} />
            <StatusCount kind="single" n={single} />
          </summary>
          <ul className="divide-y divide-hairline-soft">
            {rest.map((r) => (
              <ResultRow key={r.key} caseCode={caseCode} r={r} viewer={viewer} facts={facts} />
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function Legend() {
  return (
    <details className="rounded-lg bg-surface px-4 py-3 text-body-sm text-slate">
      <summary className="cursor-pointer list-none font-medium text-charcoal">How to read this page</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-steel">Result of each check</p>
          <ul className="space-y-1.5">
            <li className="flex items-center gap-2"><StatusTag kind="agree" /> Documents agree with each other, or with the verified value.</li>
            <li className="flex items-center gap-2"><StatusTag kind="warning" /> Probably fine, but written differently. Worth a glance.</li>
            <li className="flex items-center gap-2"><StatusTag kind="mismatch" /> Documents disagree. The person who added them can fix it.</li>
            <li className="flex items-center gap-2"><StatusTag kind="single" /> Nothing to compare yet. Not a problem.</li>
            <li className="flex items-center gap-2"><StatusTag kind="explained" /> Disagreement a person has explained.</li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-steel">How trusted the verified value is</p>
          <ul className="space-y-1.5">
            {FACT_LEVELS.map((l) => (
              <li key={l} className="flex items-center gap-2"><LevelBadge level={l} /> {FACT_LEVEL_HELP[l]}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

function ResultRow({ caseCode, r, viewer, facts }: { caseCode: string; r: CheckResult; viewer: Viewer; facts: FactView[] }) {
  const fact = r.verified ? (facts.find((f) => f.id === r.verified!.factId) ?? null) : null;
  const verifiable = isVerifiable(r.fact) && r.scope != null;
  const summary = summaryLine(r);
  return (
    <li className="py-4">
      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-charcoal">{r.label}</p>
          <StatusTag kind={r.acknowledged ? "explained" : r.status} />
        </div>
        {summary ? <p className="text-body-sm text-slate">{summary}</p> : null}
        {showMessage(r) ? <p className="text-body-sm text-slate">{r.message}</p> : null}

        {r.verified ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-surface px-3 py-2 text-body-sm">
            <span className="text-steel">Verified value</span>
            <span className="font-mono text-[15px] text-ink">{r.verified.display}</span>
            <LevelBadge level={r.verified.level} />
            <span className="text-caption text-steel">set by {r.verified.byName}</span>
          </div>
        ) : null}

        {r.groups.length ? (
          <div className="space-y-1.5">
            <p className="text-caption font-semibold uppercase tracking-wide text-steel">{r.groups.length > 1 || r.verified ? "Documents say" : "Document says"}</p>
            <ul className="space-y-1.5">
              {r.groups.map((g, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[15px] text-ink">{g.display}</span>
                  {g.sources.map((s) => (
                    <span
                      key={s.submissionId ?? "case"}
                      title={`${ROLE_INFO[s.role].label} · ${s.adderName}`}
                      className="rounded-sm bg-tint-gray px-1.5 py-0.5 font-mono text-caption text-slate"
                    >
                      {s.label}
                    </span>
                  ))}
                  {r.verified ? (
                    g.matchesVerified ? (
                      <StatusTag kind="agree" label="Matches verified value" />
                    ) : (
                      <StatusTag kind="mismatch" label="Differs from verified value" />
                    )
                  ) : null}
                  {verifiable && isVerifiable(r.fact) ? (
                    <ConfirmValueButton
                      caseCode={caseCode}
                      factKey={r.fact}
                      scope={r.scope!}
                      display={g.display}
                      action={groupAction(viewer, r.fact, fact, r.verified ? g.matchesVerified === true : false)}
                      quiet
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {isIssue(r) && !r.acknowledged && r.owners.length ? (
          <p className="flex items-center gap-1.5 text-body-sm text-steel">
            <Wrench size={14} strokeWidth={1.8} aria-hidden="true" />
            To fix: ask the {r.owners.map((o) => ROLE_INFO[o].label).join(" / ")} to correct their document{r.verified ? ", or use the other value instead" : ""}.
          </p>
        ) : null}
        {r.acknowledged ? (
          <p className="rounded-md bg-surface p-3 text-body-sm text-slate" title={formatDateTime(r.acknowledged.at)}>
            <span className="font-medium text-charcoal">{r.acknowledged.byName}:</span> {r.acknowledged.note}
          </p>
        ) : isIssue(r) && !isReadOnly(viewer.role) ? (
          <AckForm caseCode={caseCode} checkKey={r.key} valuesKey={r.valuesKey} byName={viewer.name} />
        ) : null}
      </div>
    </li>
  );
}
