/**
 * The ground-truth ladder for facts on a case. A fact is one value for one thing (the shipping bill number, or
 * one container's e-seal). It climbs: declared (someone put it there) -> confirmed (a different account in a
 * different role agrees) -> source-verified (a registry such as ULIP, later) -> observed (the gate or the
 * weighbridge, later). Nobody raises their own claim, and corroboration counts distinct roles, not documents.
 * Pure: the server actions and the pages both use these rules.
 */
import { ROLE_INFO, isReadOnly, type Role } from "@/lib/roles";
import type { ClaimValue, FactKey } from "@/lib/checks/types";

export type FactLevel = "declared" | "confirmed" | "source_verified" | "observed";
/** What is stored. "confirmed" is derived from the confirmations, never written. */
export type StoredFactLevel = "declared" | "source_verified" | "observed";

/** Everything that can be a verified fact. The container number itself is not: it is what identifies a container. */
export const FACT_KEYS = [
  "container.sizeType",
  "container.eSeal",
  "container.lineSeal",
  "container.vgm",
  "vehicle.number",
  "sb.number",
  "sb.date",
  "booking.number",
  "exporter.iec",
  "exporter.gstin",
  "invoice.number",
  "invoice.date",
  "goods.hsCodes",
  "goods.packages",
  "goods.grossWeight",
  "consignee.name",
  "port.code",
] as const satisfies readonly FactKey[];

export type VerifiableFact = (typeof FACT_KEYS)[number];

export function isVerifiable(key: string): key is VerifiableFact {
  return (FACT_KEYS as readonly string[]).includes(key);
}

const EXPORTER_SIDE: readonly Role[] = ["consignor", "cha"];
const PORT_SIDE: readonly Role[] = ["consignor", "cha", "transporter"];

/**
 * Who may put a value forward as the fact, or replace it. Anyone else on the case can confirm a value that is
 * already there, but not set a different one. (The shipping line has no account type yet, so booking and
 * container facts are open to the people who handle them.)
 */
export const FACT_AUTHORITY: Record<VerifiableFact, readonly Role[]> = {
  "exporter.iec": EXPORTER_SIDE,
  "exporter.gstin": EXPORTER_SIDE,
  "invoice.number": EXPORTER_SIDE,
  "invoice.date": EXPORTER_SIDE,
  "goods.hsCodes": EXPORTER_SIDE,
  "goods.packages": EXPORTER_SIDE,
  "goods.grossWeight": EXPORTER_SIDE,
  "sb.number": EXPORTER_SIDE,
  "sb.date": EXPORTER_SIDE,
  "port.code": EXPORTER_SIDE,
  "consignee.name": ["consignee"],
  "vehicle.number": ["transporter"],
  "booking.number": PORT_SIDE,
  "container.sizeType": PORT_SIDE,
  "container.eSeal": PORT_SIDE,
  "container.lineSeal": PORT_SIDE,
  "container.vgm": PORT_SIDE,
};

export function canDeclare(role: Role, key: VerifiableFact): boolean {
  return !isReadOnly(role) && FACT_AUTHORITY[key].includes(role);
}

export type FactConfirmation = { userId: string; role: Role; name: string; at: Date };

/** The current value of one fact, as the pages and the checks see it. */
export type FactView = {
  id: string;
  factKey: VerifiableFact;
  /** "case", or the container number a container fact belongs to. */
  scope: string;
  value: ClaimValue;
  display: string;
  level: FactLevel;
  setBy: { userId: string; name: string; role: Role };
  setAt: Date;
  /** Submission ids that said this value when it was put forward. */
  evidence: string[];
  confirmations: FactConfirmation[];
};

/** The level a fact has earned: a stored higher level wins; otherwise one agreeing account in another role makes it confirmed. */
export function effectiveLevel(f: { level: StoredFactLevel; setBy: { userId: string; role: Role }; confirmations: readonly { userId: string; role: Role }[] }): FactLevel {
  if (f.level !== "declared") return f.level;
  return f.confirmations.some((c) => c.userId !== f.setBy.userId && c.role !== f.setBy.role) ? "confirmed" : "declared";
}

export type ConfirmCheck = { ok: true } | { ok: false; reason: string };

/** May this viewer add their confirmation to the fact as it stands? */
export function canConfirm(viewer: { id: string; role: Role }, fact: Pick<FactView, "level" | "setBy" | "confirmations">): ConfirmCheck {
  if (isReadOnly(viewer.role)) return { ok: false, reason: "Your account type can only view this case." };
  if (fact.level === "source_verified" || fact.level === "observed") return { ok: false, reason: "Already verified at source." };
  if (fact.setBy.userId === viewer.id) return { ok: false, reason: "You put this value forward. Someone in another role has to confirm it." };
  if (fact.confirmations.some((c) => c.userId === viewer.id)) return { ok: false, reason: "You already confirmed this value." };
  if (fact.setBy.role === viewer.role) return { ok: false, reason: "Someone in a different role has to confirm it." };
  return { ok: true };
}

export const FACT_LEVEL_LABEL: Record<FactLevel, string> = {
  declared: "Declared",
  confirmed: "Confirmed",
  source_verified: "Source-verified",
  observed: "Observed",
};

/** The ladder in order, for the legend. */
export const FACT_LEVELS: FactLevel[] = ["declared", "confirmed", "source_verified", "observed"];

export const FACT_LEVEL_HELP: Record<FactLevel, string> = {
  declared: "Someone put this value forward. Nobody else has agreed yet.",
  confirmed: "Someone in a different role agrees with it.",
  source_verified: "Matched against an official source. Not live yet.",
  observed: "Seen at the gate or on the weighbridge. Not live yet.",
};

export const factScopeKey = (key: string, scope: string) => `${key}@${scope}`;

export type GroupAction =
  | { kind: "confirm" | "declare" | "replace" }
  | { kind: "none"; reason: string | null };

const listRoles = (roles: readonly Role[]) => roles.map((r) => ROLE_INFO[r].label).join(" or ");

/**
 * What one tap on a value in the checks or the verified list does for this viewer:
 * confirm the verified value (it equals it), put it forward (nothing is verified yet), or replace the verified value.
 */
export function groupAction(
  viewer: { id: string; role: Role },
  key: VerifiableFact,
  fact: Pick<FactView, "level" | "setBy" | "confirmations"> | null,
  matchesFact: boolean,
): GroupAction {
  if (isReadOnly(viewer.role)) return { kind: "none", reason: null };
  if (fact && matchesFact) {
    const c = canConfirm(viewer, fact);
    return c.ok ? { kind: "confirm" } : { kind: "none", reason: c.reason };
  }
  if (!canDeclare(viewer.role, key)) {
    return { kind: "none", reason: `Only a ${listRoles(FACT_AUTHORITY[key])} can ${fact ? "change" : "set"} this value.` };
  }
  return { kind: fact ? "replace" : "declare" };
}
