import "server-only";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Append-only audit trail: who did what to which entity, from where. */
export async function audit(
  entry: { actorId: string | null; action: string; entityType: string; entityId: string; details?: Record<string, unknown> },
  tx: Tx | typeof db = db,
) {
  const h = await headers();
  await tx.insert(auditLog).values({
    ...entry,
    details: entry.details ?? {},
    ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
    userAgent: h.get("user-agent"),
  });
}
