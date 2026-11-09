import "server-only";
import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { caseDocument, caseSubmission, shipmentCase } from "@/db/schema";
import { canonicalJson } from "@/lib/canonical-json";
import type { DocType } from "@/lib/documents";
import type { Role } from "@/lib/roles";
import { audit } from "@/server/audit";
import { ALLOWED_DOCUMENT_TYPES, MAX_TOTAL_UPLOAD_BYTES, removeObjects, uploadCaseDocument } from "@/server/storage";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Why an attached file can't be accepted, or null when it's fine. */
export function fileProblem(f: File | null, required = false): string | null {
  if (!f) return required ? "Choose a file to upload." : null;
  if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(f.type)) return "Upload a PDF, PNG or JPEG.";
  if (f.size > MAX_TOTAL_UPLOAD_BYTES) return "The file must be under 3.5 MB.";
  return null;
}

export type NewSubmission = {
  caseId: string;
  caseCode: string;
  type: DocType;
  actor: { id: string; role: Role };
  source: "manual" | "upload" | "ulip";
  documentNumber?: string | null;
  documentDate?: string | null;
  /** Exactly what was received. Its hash is stored next to it. */
  raw?: unknown;
  normalized?: unknown;
  provenance?: Record<string, string>;
  file?: File | null;
};

/**
 * Adds one submission (and its file, if any) to a case. The file goes to storage first; if the database
 * write then fails, the stored file is removed again. Never updates an existing submission.
 */
export async function storeSubmission(s: NewSubmission) {
  const upload = s.file ? await uploadCaseDocument(s.caseId, s.file) : null;
  const rawSha256 = s.raw === undefined ? null : createHash("sha256").update(canonicalJson(s.raw)).digest("hex");
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(caseSubmission)
        .values({
          caseId: s.caseId,
          type: s.type,
          addedBy: s.actor.id,
          addedByRole: s.actor.role,
          source: s.source,
          documentNumber: s.documentNumber ?? null,
          documentDate: s.documentDate ?? null,
          raw: s.raw ?? null,
          rawSha256,
          normalized: s.normalized ?? null,
          provenance: s.provenance ?? null,
        })
        .returning({ id: caseSubmission.id });
      if (upload && s.file) {
        await tx.insert(caseDocument).values({
          caseId: s.caseId,
          submissionId: row.id,
          storagePath: upload.path,
          fileName: s.file.name.slice(0, 200),
          mimeType: s.file.type,
          sizeBytes: upload.size,
          sha256: upload.sha256,
          uploadedBy: s.actor.id,
        });
      }
      if (s.type === "shipping_bill") await refreshCaseStatus(tx, s.caseId);
      await audit(
        {
          actorId: s.actor.id,
          action: "case.submission_added",
          entityType: "case",
          entityId: s.caseId,
          details: {
            caseCode: s.caseCode,
            submissionId: row.id,
            type: s.type,
            role: s.actor.role,
            source: s.source,
            documentNumber: s.documentNumber ?? null,
            rawSha256,
            fileSha256: upload?.sha256 ?? null,
          },
        },
        tx,
      );
      return row.id;
    });
  } catch (e) {
    if (upload) await removeObjects([upload.path]).catch(() => {});
    throw e;
  }
}

/** "Filed baseline ready" while at least one shipping bill is on the case, otherwise "Awaiting shipping bill". */
export async function refreshCaseStatus(tx: Tx, caseId: string) {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(caseSubmission)
    .where(and(eq(caseSubmission.caseId, caseId), eq(caseSubmission.type, "shipping_bill"), isNull(caseSubmission.removedAt)));
  await tx
    .update(shipmentCase)
    .set({ status: n > 0 ? "filed_baseline_ready" : "filing_pending", updatedAt: new Date() })
    .where(eq(shipmentCase.id, caseId));
}
