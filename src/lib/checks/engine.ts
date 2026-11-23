/**
 * Cross-document checks. Pure: give it the case, its current documents and any acknowledgements, and it
 * says, per fact, whether the documents agree. No document is treated as the truth: a disagreement lists
 * who said what, and everyone whose document is involved can fix theirs or acknowledge it with a note.
 */
import { DOC_TYPES } from "@/lib/documents";
import type { Role } from "@/lib/roles";
import { describeSizeType, formatContainerNo, isValidContainerNo, suggestContainerNo, typicalTareT } from "@/lib/iso6346";
import { currentDateIst } from "@/lib/format";
import { FACTS, type Closeness } from "./facts";
import { extractClaims, type CheckCase, type CheckSubmission } from "./claims";
import type { CheckAck, CheckReport, CheckResult, CheckStatus, Claim, ContainerMention, ContainerReport, FactKey, SourceRef, ValueGroup } from "./types";
import type { FactView } from "@/lib/facts/ladder";

export type { CheckCase, CheckSubmission } from "./claims";

const CASE_SOURCE_LABEL = "Case";

/** Facts shown per container, in this order; the rest are case-wide. */
const CONTAINER_FACTS: FactKey[] = ["container.number", "container.eSeal", "container.lineSeal", "container.sizeType", "container.vgm"];
const CASE_FACTS: FactKey[] = [
  "sb.number",
  "sb.date",
  "booking.number",
  "exporter.iec",
  "exporter.gstin",
  "invoice.number",
  "invoice.date",
  "consignee.name",
  "port.code",
  "goods.hsCodes",
  "goods.packages",
  "goods.grossWeight",
  "vehicle.number",
];

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** Damerau distance ≤ 1: one changed character, or two neighbours swapped. */
function oneSlipApart(a: string, b: string): boolean {
  if (a.length !== b.length || a === b) return false;
  const diff = [...a].map((c, i) => (c === b[i] ? -1 : i)).filter((i) => i >= 0);
  if (diff.length === 1) return true;
  return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
}

/**
 * Groups mentions that are the same container: they share a container number or an e-seal number.
 * Two numbers one slip apart are also joined when at least one fails its check digit, since that is
 * almost certainly a typo; two valid numbers one digit apart are left apart (boxes in one booking often
 * have neighbouring serials).
 */
export function linkContainers(mentions: ContainerMention[]): ContainerMention[][] {
  const parent = mentions.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < mentions.length; i++) {
    for (let j = i + 1; j < mentions.length; j++) {
      const a = mentions[i];
      const b = mentions[j];
      const fromSameDoc = Boolean(a.source.submissionId && a.source.submissionId === b.source.submissionId);
      const sameNo = a.number && b.number && a.number === b.number;
      const sameSeal = a.eSeal && b.eSeal && a.eSeal === b.eSeal;
      // Do not merge distinct container entries from the same document by typo matching
      const typo =
        !fromSameDoc &&
        Boolean(a.number && b.number && oneSlipApart(a.number, b.number) && (!isValidContainerNo(a.number) || !isValidContainerNo(b.number)));
      if (sameNo || sameSeal || typo) join(i, j);
    }
  }
  const groups = new Map<number, ContainerMention[]>();
  mentions.forEach((m, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), m]));
  return [...groups.values()];
}

/** Clusters claims into groups of equal values (closeness 0 to the group's first value). */
function groupClaims(fact: FactKey, claims: Claim[]): Array<{ display: string; claims: Claim[] }> {
  const compare = FACTS[fact].compare;
  const groups: Array<{ display: string; claims: Claim[] }> = [];
  // Weights: sort so greedy clustering is order-independent.
  const ordered = typeof claims[0]?.value === "number" ? [...claims].sort((a, b) => Number(a.value) - Number(b.value)) : claims;
  for (const c of ordered) {
    const g = groups.find((x) => compare(x.claims[0].value, c.value) === 0);
    if (g) g.claims.push(c);
    else groups.push({ display: c.display, claims: [c] });
  }
  return groups;
}

const isSigned = (c: Claim) => c.source.signedFacts?.includes(c.fact) ?? false;

const toValueGroups = (gs: Array<{ display: string; claims: Claim[] }>): ValueGroup[] =>
  gs.map((g) => ({
    display: g.display,
    value: g.claims[0].value,
    sources: dedupeSources(g.claims.map((c) => c.source)),
    ...(g.claims.some(isSigned) ? { signed: true } : {}),
  }));

function dedupeSources(xs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return xs.filter((s) => {
    const k = `${s.submissionId ?? "case"}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const valuesKeyOf = (groups: ValueGroup[]) =>
  groups
    .map((g) => `${g.display}=${g.sources.map((s) => s.submissionId ?? "case").sort().join(",")}`)
    .sort()
    .join("|");

/** Who can fix a problem (by role) and whose papers are behind it (by account). */
const blame = (sources: SourceRef[]): { owners: Role[]; implicated: string[] } => ({
  owners: uniq(sources.map((s) => s.role)),
  implicated: uniq(sources.map((s) => s.adderId)),
});


const LEVEL_WORD: Record<FactView["level"], string> = { declared: "stated", confirmed: "agreed", source_verified: "signed", observed: "seen at gate" };

/**
 * A fact with a verified value: every document is compared with it, not with the others. Documents that equal
 * it agree; the rest are wrong or need explaining, and their owners can fix them.
 */
function compareWithVerified(
  base: Pick<CheckResult, "key" | "scope" | "fact" | "label" | "groups" | "valuesKey">,
  compare: (a: Claim["value"], b: Claim["value"]) => Closeness,
  groups: Array<{ display: string; claims: Claim[] }>,
  valueGroups: ValueGroup[],
  v: FactView,
  softVehicle?: boolean,
): CheckResult {
  const closeness = groups.map((g) => compare(v.value, g.claims[0].value));
  const verified = { factId: v.id, display: v.display, level: v.level, byName: v.setBy.name, byRole: v.setBy.role };
  const flagged = valueGroups.map((g, i) => ({ ...g, matchesVerified: closeness[i] === 0 }));
  const valuesKey = `${base.valuesKey}|verified=${v.display}`;
  const bad = groups.filter((_, i) => closeness[i] !== 0);
  // A value a signed e-invoice carries is more than anyone's word: the verified value climbs to "signed".
  if (v.level !== "observed" && groups.some((g, i) => closeness[i] === 0 && g.claims.some(isSigned))) verified.level = "source_verified";
  if (!bad.length) {
    // Agreement with yourself proves nothing: if the one paper that matches is the one the value was taken from
    // (or the case record it was seeded from), nothing else backs it up yet. Two papers that agree do.
    const own = (s: SourceRef) => (s.submissionId ? v.evidence.includes(s.submissionId) : v.evidence.length === 0 && s.adderId === v.setBy.userId);
    const backing = dedupeSources(groups.flatMap((g) => g.claims.map((c) => c.source)));
    if (verified.level === "declared" && backing.length <= 1 && backing.every(own)) {
      return { ...base, groups: flagged, valuesKey, status: "single", message: "Only the paper this value was taken from says so.", owners: [], implicated: [], verified };
    }
    return { ...base, groups: flagged, valuesKey, status: "agree", message: "Matches the verified value.", owners: [], implicated: [], verified };
  }
  const badClaims = bad.flatMap((g) => g.claims);
  const allClose = groups.every((_, i) => closeness[i] <= 1);
  let status: CheckStatus = "mismatch";
  let message = `The verified value is ${v.display} (${LEVEL_WORD[v.level]}). ${bad.length === 1 ? "This differs" : "These differ"}: whoever added ${bad.length === 1 ? "it" : "them"} can fix it.`;
  if (allClose) {
    status = "warning";
    message = `Written differently from the verified value (${v.display}); probably the same.`;
  } else if (badClaims.every((c) => c.loose)) {
    status = "warning";
    message = `Only the LR's charged weight differs from the verified value (${v.display}); that is often rounded up for billing.`;
  } else if (softVehicle) {
    status = "warning";
    message = `Verified value is ${v.display}. Several trucks: fine if the containers travel separately, otherwise check Part B.`;
  }
  return { ...base, groups: flagged, valuesKey, status, message, ...blame(dedupeSources(badClaims.map((c) => c.source))), verified };
}

function compareFact(fact: FactKey, claims: Claim[], scopeKey: string, opts: { softVehicle?: boolean; verified?: FactView } = {}): CheckResult | null {
  if (!claims.length) return null;
  const spec = FACTS[fact];
  const groups = groupClaims(fact, claims);
  const valueGroups = toValueGroups(groups);
  const key = `${fact}@${scopeKey}`;
  const base = { key, scope: scopeKey, fact, label: spec.label, groups: valueGroups, valuesKey: valuesKeyOf(valueGroups) };
  const distinctSources = dedupeSources(claims.map((c) => c.source));
  if (opts.verified) return compareWithVerified(base, spec.compare, groups, valueGroups, opts.verified, opts.softVehicle);

  if (groups.length === 1) {
    if (distinctSources.length === 1) {
      return { ...base, status: "single", message: "One source so far.", owners: [], implicated: [] };
    }
    return { ...base, status: "agree", message: "All agree.", owners: [], implicated: [] };
  }

  // Disagreement. Soften it when it is only "close" or only loose sources differ.
  let status: CheckStatus = "mismatch";
  let message = spec.mismatch;
  const allClose = groups.every((g, i) => groups.every((h, j) => i === j || FACTS[fact].compare(g.claims[0].value, h.claims[0].value) <= (1 as Closeness)));
  const strict = claims.filter((c) => !c.loose);
  const strictGroups = groupClaims(fact, strict);
  if (allClose) {
    status = "warning";
    message = "Written differently; probably the same.";
  } else if (strict.length && strictGroups.length === 1) {
    status = "warning";
    message = "Only the LR's charged weight differs (often rounded up for billing).";
  } else if (opts.softVehicle) {
    status = "warning";
    message = "Several trucks: fine if the containers travel separately, otherwise check Part B.";
  }
  return { ...base, status, message, ...blame(distinctSources) };
}

function check(
  partial: Omit<CheckResult, "valuesKey" | "groups" | "owners" | "implicated"> & { groups?: ValueGroup[]; blamed?: SourceRef[] },
): CheckResult {
  const { blamed, ...rest } = partial;
  const groups = rest.groups ?? [];
  return { ...rest, groups, ...blame(blamed ?? []), valuesKey: valuesKeyOf(groups) || rest.message };
}

export function runChecks(input: {
  caseRecord: CheckCase;
  caseOwner: { id: string; role: Role; name: string };
  submissions: CheckSubmission[];
  acks?: CheckAck[];
  /** Verified values on the case. Facts that have one are compared with it; the rest document against document. */
  facts?: FactView[];
  today?: string;
}): CheckReport {
  const facts = input.facts ?? [];
  const today = input.today ?? currentDateIst();
  const caseSource: SourceRef = { submissionId: null, docType: "case", label: CASE_SOURCE_LABEL, role: input.caseOwner.role, adderId: input.caseOwner.id, adderName: input.caseOwner.name };
  const ex = extractClaims(input.caseRecord, caseSource, input.submissions);

  /* ── Containers ── */
  const linked = linkContainers(ex.mentions);
  const containers: ContainerReport[] = linked.map((ms) => {
    const numbers = ms.map((m) => m.number).filter((n): n is string => !!n);
    // Label: the most common number, preferring one that passes its check digit.
    const counts = new Map<string, number>();
    for (const n of numbers) counts.set(n, (counts.get(n) ?? 0) + 1 + (isValidContainerNo(n) ? 0.5 : 0));
    const label = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ms.find((m) => m.eSeal)?.eSeal ?? "Unknown";
    const claims = ms.flatMap((m) => m.claims);
    const results: CheckResult[] = [];
    for (const fact of CONTAINER_FACTS) {
      const verified = facts.find((f) => f.factKey === fact && numbers.includes(f.scope));
      const r = compareFact(fact, claims.filter((c) => c.fact === fact), label, { verified });
      if (r) results.push(r);
    }
    // Per-container vehicle consistency across Form-13, E-seal, and LR
    const containerVehicles = new Map<string, SourceRef[]>();
    for (const m of ms) {
      for (const cl of m.claims.filter((c) => c.fact === "vehicle.number")) {
        const v = String(cl.value);
        containerVehicles.set(v, [...(containerVehicles.get(v) ?? []), cl.source]);
      }
    }
    if (containerVehicles.size > 1) {
      const vGroups = [...containerVehicles.entries()].map(([vDisplay, vSources]) => ({
        display: vDisplay,
        sources: dedupeSources(vSources),
      }));
      results.push(
        check({
          key: `derived.containerVehicle@${label}`,
          fact: "derived.containerVehicle",
          label: "Vehicle mismatch for container",
          status: "mismatch",
          message: "Different trucks specified for this container across its Form-13, E-seal, or LR.",
          groups: vGroups,
          blamed: vGroups.flatMap((g) => g.sources),
        }),
      );
    }
    // Each written number on its own: does its check digit hold?
    for (const n of uniq(numbers)) {
      if (isValidContainerNo(n)) continue;
      const sources = dedupeSources(ms.filter((m) => m.number === n).map((m) => m.source));
      const sugg = suggestContainerNo(n);
      results.unshift(
        check({
          key: `derived.checkDigit@${n}`,
          fact: "derived.checkDigit",
          label: "Check digit",
          status: "invalid",
          message: `Fails the ISO 6346 check digit: almost certainly mistyped.${sugg.length ? ` Did it mean ${sugg.map(formatContainerNo).join(" / ")}?` : ""}`,
          groups: [{ display: formatContainerNo(n), sources }],
          blamed: sources,
        }),
      );
    }
    // Minimum laden weight, from any VGM given for this container.
    const size = ex.sizeTypes.find((s) => numbers.includes(s.container));
    const len = size ? describeSizeType(size.code)?.lengthFt ?? null : null;
    for (const v of ex.vgms.filter((v) => numbers.includes(v.container))) {
      const min = len === 20 ? 2.5 : len === 40 || len === 45 ? 4.5 : 2.5;
      if (v.vgmT < min) {
        results.push(
          check({
            key: `derived.minLaden@${label}@${v.source.submissionId}`,
            fact: "derived.minLaden",
            label: "VGM below a laden minimum",
            status: "warning",
            message: `Below the ${min} t a laden ${len ?? 20}-ft container weighs: probably the wrong unit.`,
            groups: [{ display: `${v.vgmT.toFixed(3)} t`, sources: [v.source] }],
            blamed: [v.source],
          }),
        );
      }
    }
    return { id: label, label: formatContainerNo(label), checkDigitOk: isValidContainerNo(label), results };
  });

  /* ── Case-wide facts ── */
  const caseChecks: CheckResult[] = [];
  for (const fact of CASE_FACTS) {
    const verified = facts.find((f) => f.factKey === fact && f.scope === "case");
    const r = compareFact(fact, ex.claims.filter((c) => c.fact === fact), "case", { softVehicle: fact === "vehicle.number" && containers.length > 1, verified });
    if (r) caseChecks.push(r);
  }

  /* ── Hand-written checks ── */
  // VGM less tare against the shipping bill's gross weight, over all containers that have a VGM.
  const sb = ex.sbGross[0];
  if (sb && containers.length) {
    let cargoT = 0;
    let estimated = false;
    let complete = true;
    const sources: SourceRef[] = [sb.source];
    for (const c of linked) {
      const nums = c.map((m) => m.number).filter(Boolean) as string[];
      const v = ex.vgms.find((x) => nums.includes(x.container) && x.tareT != null) ?? ex.vgms.find((x) => nums.includes(x.container));
      if (!v) {
        complete = false;
        break;
      }
      let tare = v.tareT;
      if (tare == null) {
        const size = ex.sizeTypes.find((s) => nums.includes(s.container));
        tare = typicalTareT(size ? describeSizeType(size.code)?.lengthFt ?? null : null);
        estimated = true;
      }
      if (tare == null) {
        complete = false;
        break;
      }
      cargoT += v.vgmT - tare;
      sources.push(v.source);
    }
    if (complete) {
      const diff = Math.abs(cargoT - sb.grossT);
      const within = diff <= 1.0 * containers.length;
      caseChecks.push(
        check({
          key: "derived.vgmVsGross@case",
          fact: "derived.vgmVsGross",
          label: "VGM less tare vs shipping bill",
          status: within ? "agree" : estimated ? "warning" : "mismatch",
          message: within
            ? "Within 1 t per container."
            : `${diff.toFixed(3)} t apart (limit 1 t per container).${estimated ? " Tare estimated from the size: add it from the container door." : ""}`,
          groups: [
            { display: `${cargoT.toFixed(3)} t (VGM − tare${estimated ? ", tare estimated" : ""})`, sources: dedupeSources(sources.slice(1)) },
            { display: `${sb.grossT.toFixed(3)} t (gross)`, sources: [sb.source] },
          ],
          blamed: within ? [] : dedupeSources(sources),
        }),
      );
    }
  }
  // E-way bills: still valid, and Part B filled in.
  for (const e of ex.ewbs) {
    if (e.validUntil && e.validUntil < today) {
      caseChecks.push(
        check({
          key: `derived.ewbValidity@${e.source.submissionId}`,
          fact: "derived.ewbValidity",
          label: "E-way bill validity",
          status: "mismatch",
          message: "Expired: extend it within 8 h of expiry or generate a new one. A truck moving on it can be detained.",
          groups: [{ display: `Valid until ${e.validUntil}`, sources: [e.source] }],
          blamed: [e.source],
        }),
      );
    } else if (e.validUntil && e.validUntil === today) {
      caseChecks.push(
        check({
          key: `derived.ewbValidity@${e.source.submissionId}`,
          fact: "derived.ewbValidity",
          label: "E-way bill validity",
          status: "warning",
          message: "Expires today: extend it from 8 h before expiry if the truck won't arrive in time.",
          groups: [{ display: `Valid until ${e.validUntil}`, sources: [e.source] }],
          blamed: [e.source],
        }),
      );
    }
    if (!e.vehicle) {
      caseChecks.push(
        check({
          key: `derived.ewbPartB@${e.source.submissionId}`,
          fact: "derived.ewbPartB",
          label: "E-way bill Part B",
          status: "warning",
          message: "No vehicle yet: not valid on the road until Part B is filled in.",
          groups: [{ display: "No vehicle", sources: [e.source] }],
          blamed: [e.source],
        }),
      );
    }
  }

  /* ── Acknowledgements and counts ── */
  const acks = input.acks ?? [];
  const all = [...containers.flatMap((c) => c.results), ...caseChecks];
  for (const r of all) {
    if (r.status === "agree" || r.status === "single") continue;
    const a = acks.find((x) => x.checkKey === r.key && x.valuesKey === r.valuesKey);
    if (a) r.acknowledged = { note: a.note, byName: a.byName, at: a.at, self: a.self };
  }
  const open = all.filter((r) => (r.status === "mismatch" || r.status === "warning" || r.status === "invalid") && !r.acknowledged);
  const bySubmission: Record<string, number> = {};
  for (const r of open) {
    // Only the papers behind the problem: one that matches the case's value isn't the one to fix.
    const behind = r.groups.filter((g) => g.matchesVerified !== true).flatMap((g) => g.sources);
    for (const s of dedupeSources(behind)) if (s.submissionId) bySubmission[s.submissionId] = (bySubmission[s.submissionId] ?? 0) + 1;
  }
  return {
    containers,
    caseChecks,
    counts: {
      mismatch: open.filter((r) => r.status === "mismatch").length,
      warning: open.filter((r) => r.status === "warning").length,
      invalid: open.filter((r) => r.status === "invalid").length,
      acknowledged: all.filter((r) => r.acknowledged).length,
      single: all.filter((r) => r.status === "single").length,
    },
    bySubmission,
  };
}

/** Plain-language name for a source's document type, for messages outside the engine. */
export function sourceTypeLabel(s: SourceRef): string {
  return s.docType === "case" ? "the case" : DOC_TYPES[s.docType].label;
}
