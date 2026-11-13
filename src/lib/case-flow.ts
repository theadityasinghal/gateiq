/**
 * Where a case is in its flow, and what the viewer should do next. Pure: the dashboard and the case page
 * feed it what they have already loaded. The gate stage has no screens yet, so it is always "later".
 */
import { canAddDocument, missingDocuments, type DocNeed, type DocType } from "@/lib/documents";
import { isReadOnly, type Role } from "@/lib/roles";

export type StepState = "done" | "current" | "todo" | "later";
export type FlowStepKey = "created" | "people" | "documents" | "checks" | "gate";
export type FlowStep = { key: FlowStepKey; label: string; state: StepState; detail?: string };
export type CaseFlow = { steps: FlowStep[]; missing: DocNeed[]; next: string };

export type CaseFlowInput = {
  role: Role;
  /** People invited to the case, accepted or not. */
  members: number;
  /** The consignee has an account on the case (invited or accepted). */
  consigneeLinked: boolean;
  /** Types of the documents currently on the case. */
  docTypes: readonly DocType[];
  needs: readonly DocNeed[];
  /** Open issues, or null when nothing has been loaded to check. */
  issues: { toFix: number; worthALook: number; forYou: number } | null;
};

const list = (xs: string[]) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, 2).join(", ")} and ${xs.length - 2} more`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function caseFlow(i: CaseFlowInput): CaseFlow {
  const missing = missingDocuments(i.needs, i.docTypes);
  const open = i.issues ? i.issues.toFix + i.issues.worthALook : 0;
  const hasDocs = i.docTypes.length > 0;

  const done: Record<Exclude<FlowStepKey, "gate">, boolean> = {
    created: true,
    people: i.members > 0,
    documents: missing.length === 0,
    // Checks on an incomplete set of papers prove little, so this waits for the papers.
    checks: hasDocs && missing.length === 0 && open === 0,
  };
  const order = ["created", "people", "documents", "checks"] as const;
  const firstOpen = order.find((k) => !done[k]);
  const detail: Partial<Record<FlowStepKey, string>> = {
    people: done.people ? plural(i.members, "person", "people") : "No one invited yet",
    documents: `${i.needs.length - missing.length} of ${i.needs.length}`,
    checks: open ? plural(open, "open check", "open checks") : undefined,
  };
  const labels: Record<FlowStepKey, string> = {
    created: "Case created",
    people: "People invited",
    documents: "Documents added",
    checks: "Checks clean",
    gate: "Gate",
  };
  const steps: FlowStep[] = [
    ...order.map((k): FlowStep => ({ key: k, label: labels[k], state: done[k] ? "done" : k === firstOpen ? "current" : "todo", detail: detail[k] })),
    { key: "gate", label: labels.gate, state: "later", detail: "Not live yet" },
  ];

  const mine = missing.filter((n) => n.anyOf.some((t) => canAddDocument(i.role, t)));
  const others = missing.filter((n) => !mine.includes(n));
  let next: string;
  if (isReadOnly(i.role)) next = open > 0 ? `Nothing to add. ${plural(open, "open flag", "open flags")} to review.` : "Nothing to add. No open flags.";
  else if (i.role === "consignor" && !i.consigneeLinked) next = "Invite your consignee to this case.";
  else if (mine.length) next = `Add ${list(mine.map((n) => n.label.toLowerCase()))}.`;
  else if (i.issues && i.issues.forYou > 0) next = `Fix or explain ${plural(i.issues.forYou, "check", "checks")} on your documents.`;
  else if (open > 0) next = `${plural(open, "open check", "open checks")}: the people who added those documents can fix them.`;
  else if (others.length) next = `Waiting for ${list(others.map((n) => n.label.toLowerCase()))}.`;
  else next = "Nothing needed from you right now.";

  return { steps, missing, next };
}
