/**
 * Who may explain a problem away ("this is expected, because…"). Pure: the server action and the Checks page
 * share it. Explaining your own paper is allowed, since a consignor working alone has nobody else, but it is
 * recorded and shown as a self-explanation so everyone who looks later can weigh it.
 */
import { isReadOnly, type Role } from "@/lib/roles";
import type { CheckResult } from "./types";

export type AckCheck = { ok: true; self: boolean } | { ok: false; reason: string };

/** Account types that may never explain a problem away: they carry or watch the goods, they don't vouch for papers. */
const CANNOT_EXPLAIN: readonly Role[] = ["driver"];

export function canAcknowledge(viewer: { id: string; role: Role }, result: Pick<CheckResult, "status" | "implicated" | "acknowledged">): AckCheck {
  if (isReadOnly(viewer.role)) return { ok: false, reason: "Your account type can only view this case." };
  if (CANNOT_EXPLAIN.includes(viewer.role)) return { ok: false, reason: "Drivers can't explain a check. Ask the person who added the papers." };
  if (result.status !== "mismatch" && result.status !== "warning" && result.status !== "invalid") return { ok: false, reason: "There is nothing to explain." };
  if (result.acknowledged) return { ok: false, reason: "Someone has already explained this." };
  return { ok: true, self: result.implicated.includes(viewer.id) };
}
