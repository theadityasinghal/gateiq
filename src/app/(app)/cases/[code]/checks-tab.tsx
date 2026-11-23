import { Check, CircleAlert, CircleDashed, TriangleAlert } from "lucide-react";
import type { CheckReport, CheckResult, SourceRef } from "@/lib/checks/types";
import { FACTS } from "@/lib/checks/facts";
import { DOC_TYPES } from "@/lib/documents";
import { ROLE_INFO, isReadOnly, type Role } from "@/lib/roles";
import { groupAction, isVerifiable, type FactView } from "@/lib/facts/ladder";
import { ConfirmValueButton } from "@/components/confirm-value-button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { canAcknowledge } from "@/lib/checks/ack";
import { AckForm } from "./ack-form";

type Viewer = { id: string; role: Role; name: string };
type Item = { r: CheckResult; scope: string };

const isIssue = (r: CheckResult) => r.status === "mismatch" || r.status === "invalid" || r.status === "warning";
const isCompared = (r: CheckResult) => r.fact in FACTS;
const sourceName = (s: SourceRef) => (s.docType === "case" ? "Case details" : DOC_TYPES[s.docType].label);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const ownersText = (owners: Role[]) => owners.map((o) => ROLE_INFO[o].label).join(" or ");

/** One plain sentence on what is wrong. */
function headline(r: CheckResult): string {
  if (!isCompared(r)) return r.message;
  if (r.verified) {
    if (r.status === "warning") return "Written a little differently from the agreed value. Probably the same.";
    return "Does not match the agreed value.";
  }
  if (r.status === "warning") return r.message;
  return "The papers say different things.";
}

/**
 * Plain checks: what needs attention first, each with what every paper says and what to do about it.
 * Everything that is fine is folded away underneath.
 */
export function ChecksTab({ caseCode, report, viewer, facts }: { caseCode: string; report: CheckReport; viewer: Viewer; facts: FactView[] }) {
  const items: Item[] = [
    ...report.containers.flatMap((c) => c.results.map((r) => ({ r, scope: `Container ${c.label}` }))),
    ...report.caseChecks.map((r) => ({ r, scope: "Whole shipment" })),
  ];
  const open = items.filter((i) => isIssue(i.r) && !i.r.acknowledged);
  const explained = items.filter((i) => isIssue(i.r) && i.r.acknowledged);
  const onePaper = items.filter((i) => i.r.status === "single");
  const fine = items.filter((i) => !isIssue(i.r) && i.r.status !== "single");
  const toFix = open.filter((i) => i.r.status !== "warning").length;

  if (!items.length) {
    return (
      <div className="animate-rise space-y-3">
        <h2 className="text-h5">Checks</h2>
        <p className="rounded-lg bg-surface p-6 text-body-sm text-slate">Add some documents and we will check them against each other.</p>
      </div>
    );
  }

  return (
    <div className="animate-rise space-y-8">
      <div className="space-y-1">
        <h2 className="text-h5">Checks</h2>
        <p className="text-body-sm text-slate">
          {open.length === 0
            ? onePaper.length
              ? `Nothing disagrees. ${plural(onePaper.length, "value is", "values are")} on one paper only, so nothing backs ${onePaper.length === 1 ? "it" : "them"} up yet.`
              : "Everything we could compare matches."
            : toFix > 0
              ? `${plural(toFix, "thing needs", "things need")} fixing${open.length > toFix ? `, and ${open.length - toFix} more to look at` : ""}.`
              : `${plural(open.length, "thing is", "things are")} worth a quick look.`}
        </p>
      </div>

      {open.length ? (
        <ul className="space-y-4">
          {open.map((i) => (
            <IssueCard key={i.r.key + i.scope} caseCode={caseCode} item={i} viewer={viewer} facts={facts} />
          ))}
        </ul>
      ) : null}

      {explained.length ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-body-sm font-medium text-slate">
            {plural(explained.length, "difference", "differences")} explained by someone <span className="text-link-blue group-open:hidden">· show</span>
          </summary>
          <ul className="mt-3 space-y-4">
            {explained.map((i) => (
              <IssueCard key={i.r.key + i.scope} caseCode={caseCode} item={i} viewer={viewer} facts={facts} />
            ))}
          </ul>
        </details>
      ) : null}

      {onePaper.length ? (
        <details className="group">
          <summary className="cursor-pointer list-none text-body-sm font-medium text-slate">
            {plural(onePaper.length, "value is", "values are")} on one paper only <span className="text-link-blue group-open:hidden">· show</span>
          </summary>
          <p className="mt-2 text-caption text-steel">Nothing contradicts these, but nothing else backs them up yet either. Another paper, or someone in another role agreeing, would.</p>
          <ul className="mt-3 divide-y divide-hairline-soft">
            {onePaper.map((i) => (
              <FineRow key={i.r.key + i.scope} caseCode={caseCode} item={i} viewer={viewer} facts={facts} />
            ))}
          </ul>
        </details>
      ) : null}

      {fine.length ? (
        <details className="group" open={!open.length && !explained.length && !onePaper.length}>
          <summary className="cursor-pointer list-none text-body-sm font-medium text-slate">
            {plural(fine.length, "check is", "checks are")} fine <span className="text-link-blue group-open:hidden">· show</span>
          </summary>
          <ul className="mt-3 divide-y divide-hairline-soft">
            {fine.map((i) => (
              <FineRow key={i.r.key + i.scope} caseCode={caseCode} item={i} viewer={viewer} facts={facts} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function IssueCard({ caseCode, item, viewer, facts }: { caseCode: string; item: Item; viewer: Viewer; facts: FactView[] }) {
  const { r, scope } = item;
  const fact = r.verified ? (facts.find((f) => f.id === r.verified!.factId) ?? null) : null;
  const verifiable = isVerifiable(r.fact) && r.scope != null;
  const serious = r.status !== "warning" && !r.acknowledged;
  const Icon = serious ? CircleAlert : TriangleAlert;
  const showValues = isCompared(r) && r.groups.length > 0;
  const ack = canAcknowledge(viewer, r);
  return (
    <li className={cn("rounded-lg border border-hairline-soft border-l-4 p-5", r.acknowledged ? "border-l-stone" : serious ? "border-l-error" : "border-l-tag-orange-fg")}>
      <p className="text-caption text-steel">{scope}</p>
      <div className="mt-1 flex items-start gap-2.5">
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" className={cn("mt-0.5 shrink-0", r.acknowledged ? "text-stone" : serious ? "text-error" : "text-tag-orange-fg")} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold text-charcoal">{r.label}</h3>
          <p className="mt-0.5 text-body-sm text-slate">{headline(r)}</p>
        </div>
      </div>

      {showValues ? (
        <ul className="mt-4 space-y-2.5">
          {r.groups.map((g, i) => {
            const good = r.verified ? g.matchesVerified === true : false;
            return (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {r.verified ? (
                  good ? (
                    <Check size={18} strokeWidth={2.2} aria-label="Matches" role="img" className="shrink-0 text-tag-green-fg" />
                  ) : (
                    <span aria-label="Does not match" role="img" className="grid h-[18px] w-[18px] shrink-0 place-items-center text-error">✕</span>
                  )
                ) : null}
                <div className="min-w-0">
                  <p className="break-words text-[16px] font-medium text-ink">{g.display}</p>
                  <p className="text-caption text-steel">
                    {g.sources.map((s) => sourceName(s)).filter((v, idx, a) => a.indexOf(v) === idx).join(", ")}
                    {g.signed ? " · signed e-invoice" : ""}
                    {r.verified ? (good ? " · the case's value" : " · does not match") : ""}
                  </p>
                </div>
                {verifiable && isVerifiable(r.fact) ? (
                  <ConfirmValueButton
                    caseCode={caseCode}
                    factKey={r.fact}
                    scope={r.scope!}
                    display={g.display}
                    action={groupAction(viewer, r.fact, fact, r.verified ? good : false)}
                    quiet
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : r.groups.length ? (
        <p className="mt-3 text-caption text-steel">From {r.groups.flatMap((g) => g.sources).map(sourceName).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</p>
      ) : null}

      {!r.acknowledged && r.owners.length ? (
        <p className="mt-4 text-body-sm text-charcoal">
          <span className="font-semibold">What to do: </span>
          ask the {ownersText(r.owners)} to correct it{r.verified ? ", or pick the right value above" : ""}.
        </p>
      ) : null}

      {r.acknowledged ? (
        <p className="mt-4 rounded-md bg-surface p-3 text-body-sm text-slate" title={formatDateTime(r.acknowledged.at)}>
          <span className="font-medium text-charcoal">
            {r.acknowledged.byName} explained{r.acknowledged.self ? " (one of the people who added these papers)" : ""}:
          </span>{" "}
          {r.acknowledged.note}
        </p>
      ) : ack.ok ? (
        <div className="mt-3">
          <AckForm caseCode={caseCode} checkKey={r.key} valuesKey={r.valuesKey} byName={viewer.name} self={ack.self} />
        </div>
      ) : !isReadOnly(viewer.role) ? (
        <p className="mt-3 text-caption text-stone">{ack.reason}</p>
      ) : null}
    </li>
  );
}

/** One line for a check that is fine, or that only one paper states. Either can be agreed with from here. */
function FineRow({ caseCode, item, viewer, facts }: { caseCode: string; item: Item; viewer: Viewer; facts: FactView[] }) {
  const { r, scope } = item;
  const fact = r.verified ? (facts.find((f) => f.id === r.verified!.factId) ?? null) : null;
  const verifiable = isVerifiable(r.fact) && r.scope != null;
  const g = r.groups[0];
  const names = r.groups.flatMap((x) => x.sources).map(sourceName).filter((v, i, a) => a.indexOf(v) === i);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      {r.status === "single" ? (
        <CircleDashed size={16} strokeWidth={2} aria-label="One paper only" role="img" className="shrink-0 text-stone" />
      ) : (
        <Check size={16} strokeWidth={2.2} aria-hidden="true" className="shrink-0 text-tag-green-fg" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-body-sm text-ink">
          <span className="font-medium">{r.label}</span>
          {g ? <span className="text-slate"> · {g.display}</span> : null}
        </p>
        <p className="text-caption text-steel">
          {scope} · {r.status === "single" ? (r.verified ? r.message : `only on ${names.join(", ") || "one paper"}`) : names.length > 1 ? `${names.join(", ")} agree` : names[0]}
        </p>
      </div>
      {verifiable && g && isVerifiable(r.fact) ? (
        <ConfirmValueButton caseCode={caseCode} factKey={r.fact} scope={r.scope!} display={g.display} action={groupAction(viewer, r.fact, fact, r.verified ? g.matchesVerified === true : false)} quiet />
      ) : null}
    </li>
  );
}
