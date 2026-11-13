/**
 * The Verified info list: every fact worth verifying on a case, grouped for reading, with the values the
 * documents give and what the viewer can do with each. Built from the checks report, so it shows exactly what
 * the checks compared. Pure and serializable: the page builds it, a client component renders it.
 */
import type { CheckReport, CheckResult, CheckStatus } from "@/lib/checks/types";
import { FACTS } from "@/lib/checks/facts";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { groupAction, type FactLevel, type FactView, type GroupAction, type VerifiableFact } from "./ladder";

export type FactSummary = {
  id: string;
  display: string;
  level: FactLevel;
  setByName: string;
  setByRole: Role;
  setAt: Date;
  confirmations: Array<{ name: string; role: Role }>;
};

export type RowGroup = {
  display: string;
  sources: Array<{ label: string; roleLabel: string; adderName: string }>;
  /** Whether this value equals the verified one; null when nothing is verified yet. */
  matches: boolean | null;
  action: GroupAction;
};

export type VerifiedRowData = {
  id: string;
  factKey: VerifiableFact;
  scope: string;
  label: string;
  fact: FactSummary | null;
  canWithdraw: boolean;
  status: CheckStatus | "none";
  groups: RowGroup[];
};

export type VerifiedSectionData = { id: string; title: string; container: boolean; rows: VerifiedRowData[] };

const SECTIONS: Array<{ id: string; title: string; keys: VerifiableFact[] }> = [
  { id: "exporter", title: "Exporter", keys: ["exporter.iec", "exporter.gstin"] },
  { id: "shipment", title: "Shipping bill and booking", keys: ["sb.number", "sb.date", "booking.number", "port.code"] },
  { id: "invoice", title: "Invoice", keys: ["invoice.number", "invoice.date"] },
  { id: "goods", title: "Goods", keys: ["goods.hsCodes", "goods.packages", "goods.grossWeight"] },
  { id: "consignee", title: "Consignee", keys: ["consignee.name"] },
  { id: "transport", title: "Transport", keys: ["vehicle.number"] },
];
const CONTAINER_KEYS: VerifiableFact[] = ["container.sizeType", "container.eSeal", "container.lineSeal", "container.vgm"];

export const summarizeFact = (f: FactView): FactSummary => ({
  id: f.id,
  display: f.display,
  level: f.level,
  setByName: f.setBy.name,
  setByRole: f.setBy.role,
  setAt: f.setAt,
  confirmations: f.confirmations.map((c) => ({ name: c.name, role: c.role })),
});

export function buildVerifiedSections(
  report: CheckReport,
  facts: FactView[],
  viewer: { id: string; role: Role },
  access: "owner" | "member",
): VerifiedSectionData[] {
  const used = new Set<string>();
  const row = (result: CheckResult | null, key: VerifiableFact, scope: string, fact: FactView | undefined): VerifiedRowData => {
    if (fact) used.add(fact.id);
    const groups: RowGroup[] = (result?.groups ?? []).map((g) => {
      const matches = fact ? (g.matchesVerified ?? false) : null;
      return {
        display: g.display,
        sources: g.sources.map((s) => ({ label: s.label, roleLabel: ROLE_INFO[s.role].label, adderName: s.adderName })),
        matches,
        action: groupAction(viewer, key, fact ?? null, matches === true),
      };
    });
    return {
      id: `${key}@${scope}`,
      factKey: key,
      scope,
      label: FACTS[key].label,
      fact: fact ? summarizeFact(fact) : null,
      canWithdraw: !!fact && (access === "owner" || groupAction(viewer, key, null, false).kind !== "none"),
      status: result?.status ?? "none",
      groups,
    };
  };

  const caseResult = (key: VerifiableFact) => report.caseChecks.find((r) => r.fact === key && r.scope === "case") ?? null;
  const caseFact = (key: VerifiableFact) => facts.find((f) => f.factKey === key && f.scope === "case");

  const out: VerifiedSectionData[] = [];
  for (const s of SECTIONS) {
    const rows = s.keys.flatMap((key) => {
      const result = caseResult(key);
      const fact = caseFact(key);
      return result || fact ? [row(result, key, "case", fact)] : [];
    });
    if (rows.length) out.push({ id: s.id, title: s.title, container: false, rows });
  }
  for (const c of report.containers) {
    const rows = CONTAINER_KEYS.flatMap((key) => {
      const result = c.results.find((r) => r.fact === key) ?? null;
      const fact = facts.find((f) => f.factKey === key && (f.scope === c.label || f.scope === c.id));
      return result || fact ? [row(result, key, c.id, fact)] : [];
    });
    if (rows.length) out.push({ id: `container-${c.id}`, title: c.label, container: true, rows });
  }
  // Verified values no document mentions any more (a document was removed): still shown, so they can be withdrawn.
  const orphans = facts.filter((f) => !used.has(f.id));
  if (orphans.length) {
    out.push({ id: "orphans", title: "Not on any document now", container: false, rows: orphans.map((f) => row(null, f.factKey, f.scope, f)) });
  }
  return out;
}
