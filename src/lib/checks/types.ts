import type { DocType } from "@/lib/documents";
import type { Role } from "@/lib/roles";

/** Who said something: a document on the case, or the consignor's own case record. */
export type SourceRef = {
  submissionId: string | null;
  docType: DocType | "case";
  /** Short label for the UI: "SB 1234567", "F13 BOM123", "Case". */
  label: string;
  role: Role;
  adderName: string;
};

export type FactKey =
  | "container.number"
  | "container.sizeType"
  | "container.eSeal"
  | "container.lineSeal"
  | "container.vgm"
  | "vehicle.number"
  | "sb.number"
  | "sb.date"
  | "booking.number"
  | "exporter.iec"
  | "exporter.gstin"
  | "invoice.number"
  | "invoice.date"
  | "goods.hsCodes"
  | "goods.packages"
  | "goods.grossWeight"
  | "consignee.name"
  | "port.code";

export type ClaimValue = string | number | string[];

/** One thing one source says about one fact. */
export type Claim = {
  fact: FactKey;
  value: ClaimValue;
  /** How to show the value. */
  display: string;
  source: SourceRef;
  /** A loose source only produces warnings when it alone disagrees (e.g. the LR's charged weight). */
  loose?: boolean;
};

/** A mention of one container in one document; its claims are container-scoped. */
export type ContainerMention = {
  number: string | null;
  eSeal: string | null;
  source: SourceRef;
  claims: Claim[];
};

export type CheckStatus = "agree" | "mismatch" | "warning" | "single" | "invalid";

export type ValueGroup = { display: string; sources: SourceRef[] };

export type CheckResult = {
  /** Stable across page loads: fact plus scope, e.g. "container.number@MSKU1234565". */
  key: string;
  fact: FactKey | "derived.vgmVsGross" | "derived.ewbValidity" | "derived.ewbPartB" | "derived.minLaden" | "derived.checkDigit";
  label: string;
  status: CheckStatus;
  message: string;
  groups: ValueGroup[];
  /** Roles that can fix it: whoever added the documents involved. Empty when nothing to fix. */
  owners: Role[];
  /** Identifies the exact disagreement; an acknowledgement only holds while this stays the same. */
  valuesKey: string;
  acknowledged?: { note: string; byName: string; at: Date } | null;
};

export type ContainerReport = { id: string; label: string; checkDigitOk: boolean; results: CheckResult[] };

export type CheckReport = {
  containers: ContainerReport[];
  caseChecks: CheckResult[];
  counts: { mismatch: number; warning: number; invalid: number; acknowledged: number };
  /** Open issues per submission id, for the chips on document cards. */
  bySubmission: Record<string, number>;
};

export type CheckAck = { checkKey: string; valuesKey: string; note: string; byName: string; at: Date };
