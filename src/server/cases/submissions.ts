"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { caseSubmission, checkAck, documentExtraction, shipmentCase } from "@/db/schema";
import { changedFields } from "@/lib/extract/postprocess";
import { DOC_TYPES, canAddDocument, docLabelInline, isDocType, type DocType } from "@/lib/documents";
import { ROLE_INFO } from "@/lib/roles";
import { requireOnboardedUser } from "@/server/session";
import { audit } from "@/server/audit";
import { fileOrNull, parsePayload } from "./form-helpers";
import { DOC_HANDLERS } from "./doc-handlers";
import { SupersededError, fileProblem, refreshCaseStatus, storeSubmission } from "./submission-store";
import { getCaseForUser } from "./service";

export type SubmissionFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Every add goes through here: signed in, on the case (owner or accepted member), and an account type
 * allowed to add this kind of document. Server Actions can be posted to directly, so the UI hiding a
 * button is never the check.
 */
async function gate(caseCode: string, type: DocType) {
  const me = await requireOnboardedUser();
  const c = await getCaseForUser(caseCode, me.id);
  if (!c) return { error: "You don't have access to this case." } as const;
  if (!canAddDocument(me.role, type)) {
    return { error: `A ${ROLE_INFO[me.role].label} can't add this document (${docLabelInline(type)}).` } as const;
  }
  return { me, c } as const;
}

/**
 * Stores the submission, turning a storage or database failure into a message on the form
 * instead of an unhandled error that takes the whole page down.
 */
async function trySave(s: Parameters<typeof storeSubmission>[0]): Promise<SubmissionFormState | null> {
  try {
    await storeSubmission(s);
    return null;
  } catch (e) {
    if (e instanceof SupersededError) return { error: "The version you were correcting has been removed or already corrected. Go back to the case and start again." };
    console.error("Saving submission failed", { caseCode: s.caseCode, type: s.type }, e);
    return { error: s.file ? "The file couldn't be uploaded. Please try again." : "This couldn't be saved. Please try again." };
  }
}

function done(caseCode: string): never {
  revalidatePath(`/cases/${caseCode}`, "layout");
  revalidatePath("/dashboard");
  redirect(`/cases/${caseCode}/documents`);
}

/**
 * Adds a structured document (shipping bill, e-way bill, lorry receipt, Form-13, VGM, e-seal record,
 * invoice, packing list). The form posts its fields as one JSON `payload`; the type's handler validates,
 * checks codes against the masters and normalises. What was typed is stored verbatim next to the result.
 */
export async function submitDocument(caseCode: string, type: DocType, _prev: SubmissionFormState, formData: FormData): Promise<SubmissionFormState> {
  const handler = isDocType(type) ? DOC_HANDLERS[type] : undefined;
  if (!handler) return { error: "Unknown document type." };
  const g = await gate(caseCode, type);
  if ("error" in g) return { error: g.error };
  const { me, c } = g;

  const file = fileOrNull(formData.get("file"));
  const bad = fileProblem(file);
  if (bad) return { fieldErrors: { file: bad } };

  const out = await handler.run(parsePayload(formData));
  if (!out.ok) return { error: out.error, fieldErrors: out.fieldErrors };
  const uuidField = (k: string) => {
    const v = String(formData.get(k) ?? "");
    return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
  };
  const supersedesId = uuidField("supersedesId");
  const extractionId = uuidField("extractionId");

  // Confirming a reading: it must be this person's, for this case and type, and not used already.
  let extraction: typeof documentExtraction.$inferSelect | null = null;
  if (extractionId) {
    [extraction] = await db
      .select()
      .from(documentExtraction)
      .where(and(eq(documentExtraction.id, extractionId), eq(documentExtraction.caseId, c.id), eq(documentExtraction.userId, me.id), eq(documentExtraction.type, type)));
    if (!extraction) return { error: "That reading isn't available any more. Read the file again, or type the details in." };
    const [used] = await db.select({ id: caseSubmission.id }).from(caseSubmission).where(eq(caseSubmission.extractionId, extraction.id));
    if (used) return { error: "This reading has already been saved as a document." };
  }
  const offered = (extraction?.offered as { initial?: Record<string, unknown> } | undefined)?.initial ?? {};

  const failed = await trySave({
    caseId: c.id,
    caseCode: c.caseCode,
    type,
    actor: { id: me.id, role: me.role },
    source: extraction ? "extracted" : "manual",
    documentNumber: out.normalized.documentNumber,
    documentDate: out.normalized.documentDate,
    raw: extraction
      ? { enteredAs: "extracted", extractionId: extraction.id, model: extraction.model, qr: !!extraction.qrText, form: out.form, ...changedFields(offered, out.form) }
      : { enteredAs: "form", form: out.form },
    normalized: out.normalized,
    provenance: out.provenance,
    file: extraction ? null : file,
    supersedesId,
    extraction: extraction
      ? { id: extraction.id, storagePath: extraction.storagePath, fileName: extraction.fileName, mimeType: extraction.mimeType, sizeBytes: extraction.sizeBytes, sha256: extraction.sha256 }
      : null,
  });
  if (failed) return failed;
  done(c.caseCode);
}

/** Invoices, packing lists and certificates: a file, with the document's number and date if the adder knows them. */
export async function addFileDocument(
  caseCode: string,
  type: DocType,
  _prev: SubmissionFormState,
  formData: FormData,
): Promise<SubmissionFormState> {
  if (!isDocType(type) || DOC_TYPES[type].form !== "file") return { error: "Unknown document type." };
  const g = await gate(caseCode, type);
  if ("error" in g) return { error: g.error };
  const { me, c } = g;

  const file = fileOrNull(formData.get("file"));
  const fieldErrors: Record<string, string> = {};
  const bad = fileProblem(file, true);
  if (bad) fieldErrors.file = bad;
  const documentNumber = String(formData.get("documentNumber") ?? "").trim().slice(0, 60) || null;
  const documentDate = String(formData.get("documentDate") ?? "").trim() || null;
  if (documentDate && !/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) fieldErrors.documentDate = "Choose a valid date.";
  else if (documentDate && documentDate > new Date().toISOString().slice(0, 10)) fieldErrors.documentDate = "The date can't be in the future.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const failed = await trySave({
    caseId: c.id,
    caseCode: c.caseCode,
    type,
    actor: { id: me.id, role: me.role },
    source: "upload",
    documentNumber,
    documentDate,
    file,
  });
  if (failed) return failed;
  done(c.caseCode);
}

/**
 * Takes back something you added. Only your own, and only while you are still on the case.
 * The row stays (marked removed) so the record trail is complete; it just stops showing.
 */
export async function removeSubmission(formData: FormData): Promise<void> {
  const me = await requireOnboardedUser();
  const id = String(formData.get("submissionId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const [row] = await db
    .select({ id: caseSubmission.id, caseId: caseSubmission.caseId, type: caseSubmission.type, addedBy: caseSubmission.addedBy, caseCode: shipmentCase.caseCode })
    .from(caseSubmission)
    .innerJoin(shipmentCase, eq(shipmentCase.id, caseSubmission.caseId))
    .where(and(eq(caseSubmission.id, id), isNull(caseSubmission.removedAt)));
  if (!row || row.addedBy !== me.id) return;
  if (!(await getCaseForUser(row.caseCode, me.id))) return;

  await db.transaction(async (tx) => {
    await tx
      .update(caseSubmission)
      .set({ removedAt: new Date(), removedBy: me.id })
      .where(and(eq(caseSubmission.id, row.id), isNull(caseSubmission.removedAt)));
    if (row.type === "shipping_bill") await refreshCaseStatus(tx, row.caseId);
    await audit(
      { actorId: me.id, action: "case.submission_removed", entityType: "case", entityId: row.caseId, details: { caseCode: row.caseCode, submissionId: row.id, type: row.type } },
      tx,
    );
  });
  revalidatePath(`/cases/${row.caseCode}`, "layout");
  revalidatePath("/dashboard");
}

/**
 * Explains a disagreement without changing any document ("truck swapped at Bhiwandi, Part B updated").
 * Anyone on the case may do it; the note and who wrote it show on the check. It lapses by itself as soon
 * as the values involved change.
 */
export async function acknowledgeCheck(caseCode: string, _prev: { error?: string; ok?: boolean }, formData: FormData): Promise<{ error?: string; ok?: boolean }> {
  const me = await requireOnboardedUser();
  const c = await getCaseForUser(caseCode, me.id);
  if (!c) return { error: "You don't have access to this case." };
  const checkKey = String(formData.get("checkKey") ?? "").slice(0, 300);
  const valuesKey = String(formData.get("valuesKey") ?? "").slice(0, 4000);
  const note = String(formData.get("note") ?? "").trim();
  if (!checkKey || !valuesKey) return { error: "Missing check." };
  if (note.length < 5) return { error: "Say briefly why this is fine (at least a few words)." };
  if (note.length > 500) return { error: "Keep the note under 500 characters." };
  await db.transaction(async (tx) => {
    await tx.insert(checkAck).values({ caseId: c.id, checkKey, valuesKey, note, userId: me.id });
    await audit({ actorId: me.id, action: "case.check_acknowledged", entityType: "case", entityId: c.id, details: { caseCode: c.caseCode, checkKey, note } }, tx);
  });
  revalidatePath(`/cases/${c.caseCode}`, "layout");
  return { ok: true };
}
