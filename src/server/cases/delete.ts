import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { caseDocument, documentExtraction, shipmentCase } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Deletes cases for good. Goods lines, documents, submissions, people, notes, verified values and readings go
 * with them (they cascade). Returns the stored files to remove from storage once the transaction has committed;
 * a failure there leaves unreachable private files, never exposed ones. The audit rows are kept.
 */
export async function deleteCasesCascade(tx: Tx, caseIds: string[]): Promise<string[]> {
  if (!caseIds.length) return [];
  const [docs, readings] = await Promise.all([
    tx.select({ path: caseDocument.storagePath }).from(caseDocument).where(inArray(caseDocument.caseId, caseIds)),
    tx.select({ path: documentExtraction.storagePath }).from(documentExtraction).where(inArray(documentExtraction.caseId, caseIds)),
  ]);
  await tx.delete(shipmentCase).where(inArray(shipmentCase.id, caseIds));
  return [...new Set([...docs.map((d) => d.path), ...readings.map((r) => r.path)])];
}
