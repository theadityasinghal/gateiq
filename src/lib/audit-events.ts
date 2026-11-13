/**
 * How a case's audit rows read in the Activity section: an icon, a tone, a filter group and a sentence that
 * follows the person's name ("Asha" + "added a shipping bill 1234567"). Pure, so it is tested without a database.
 */
import { DOC_TYPES, isDocType, docLabelInline } from "@/lib/documents";
import { FACTS } from "@/lib/checks/facts";
import type { FactKey } from "@/lib/checks/types";
import { inlineLabel } from "@/lib/format";

export type ActivityIcon = "case" | "upload" | "edit" | "trash" | "scan" | "note" | "badge" | "shield" | "swap" | "eraser" | "invite" | "accept" | "decline" | "remove" | "dot";
export type ActivityTone = "green" | "purple" | "sky" | "orange" | "red" | "gray";
export type ActivityGroup = "documents" | "people" | "verified" | "case";

export type ActivityEvent = { icon: ActivityIcon; tone: ActivityTone; group: ActivityGroup; text: string };

export const ACTIVITY_GROUP_LABEL: Record<"all" | ActivityGroup, string> = {
  all: "All",
  documents: "Documents",
  people: "People",
  verified: "Verified info and checks",
  case: "Case",
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function docText(details: Record<string, unknown>): string {
  const type = str(details.type);
  const label = type && isDocType(type) ? docLabelInline(type) : "a document";
  const number = str(details.documentNumber);
  return number ? `${label} ${number}` : label;
}

function factText(details: Record<string, unknown>): { label: string; display: string | null; scope: string | null } {
  const key = str(details.factKey);
  const label = key && key in FACTS ? inlineLabel(FACTS[key as FactKey].label) : "a value";
  const scope = str(details.scope);
  return { label, display: str(details.display), scope: scope && scope !== "case" ? scope : null };
}

const a = (article: string) => (/^[aeiou]/i.test(article) ? "an" : "a");

export function describeEvent(action: string, details: Record<string, unknown>): ActivityEvent {
  switch (action) {
    case "case.created":
      return { icon: "case", tone: "purple", group: "case", text: "created the case" };
    case "case.submission_added":
      return { icon: "upload", tone: "green", group: "documents", text: `added ${a(docText(details))} ${docText(details)}` };
    case "case.submission_corrected":
      return { icon: "edit", tone: "sky", group: "documents", text: `corrected ${docText(details)}` };
    case "case.submission_removed":
      return { icon: "trash", tone: "red", group: "documents", text: `removed ${docText(details)}` };
    case "case.document_read": {
      const type = str(details.type);
      return { icon: "scan", tone: "gray", group: "documents", text: `had ${type && isDocType(type) ? `a ${DOC_TYPES[type].label.toLowerCase()}` : "a file"} read` };
    }
    case "case.check_acknowledged": {
      const note = str(details.note);
      return { icon: "note", tone: "orange", group: "verified", text: note ? `explained a check: “${note}”` : "explained a check" };
    }
    case "fact.declared": {
      const seeded = Array.isArray(details.seeded) ? details.seeded.length : 0;
      if (seeded) return { icon: "badge", tone: "purple", group: "verified", text: `declared ${seeded} values from the case record` };
      const f = factText(details);
      return { icon: "badge", tone: "purple", group: "verified", text: `put forward ${f.label}${f.display ? ` ${f.display}` : ""}${f.scope ? ` for ${f.scope}` : ""}` };
    }
    case "fact.confirmed": {
      const f = factText(details);
      return { icon: "shield", tone: "green", group: "verified", text: `confirmed ${f.label}${f.display ? ` ${f.display}` : ""}${f.scope ? ` for ${f.scope}` : ""}` };
    }
    case "fact.replaced": {
      const f = factText(details);
      const from = str(details.from);
      return { icon: "swap", tone: "orange", group: "verified", text: `changed ${f.label} ${from ? `from ${from} ` : ""}to ${f.display ?? "a new value"}` };
    }
    case "fact.retired": {
      const f = factText(details);
      return { icon: "eraser", tone: "gray", group: "verified", text: `withdrew the verified ${f.label}${f.display ? ` (${f.display})` : ""}` };
    }
    case "case.member_invited": {
      const who = str(details.invitee);
      return { icon: "invite", tone: "sky", group: "people", text: `invited ${who ? `@${who}` : "someone"}` };
    }
    case "case.invite_accepted":
      return { icon: "accept", tone: "green", group: "people", text: "accepted the invite" };
    case "case.invite_declined":
      return { icon: "decline", tone: "gray", group: "people", text: "declined the invite" };
    case "case.invite_cancelled":
      return { icon: "decline", tone: "gray", group: "people", text: "cancelled an invite" };
    case "case.member_removed": {
      const removed = Array.isArray(details.removed) ? details.removed : [];
      const names = removed.flatMap((r) => (r && typeof r === "object" && "username" in r && typeof r.username === "string" ? [`@${r.username}`] : []));
      return { icon: "remove", tone: "red", group: "people", text: names.length ? `removed ${names.join(", ")}` : "removed a member" };
    }
    default:
      return { icon: "dot", tone: "gray", group: "case", text: action.replace(/[._]/g, " ") };
  }
}
