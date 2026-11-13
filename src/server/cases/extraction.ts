"use server";

import { db } from "@/db";
import { documentExtraction } from "@/db/schema";
import { canAddDocument, isDocType, type DocType } from "@/lib/documents";
import { DOC_FORMS, type FieldMeta } from "@/lib/doc-forms";
import { offerFromReading } from "@/lib/extract/postprocess";
import { EXTRACTION_PROMPT_VERSION } from "@/lib/extract/schema";
import { parseQr, qrAppliesTo } from "@/lib/qr/parse";
import { requireOnboardedUser } from "@/server/session";
import { audit } from "@/server/audit";
import { removeObjects, uploadCaseDocument } from "@/server/storage";
import { geminiConfigured, readWithGemini } from "@/server/extract/gemini";
import { fileOrNull } from "./form-helpers";
import { fileProblem } from "./submission-store";
import { getCaseForUser } from "./service";

export type ExtractState = {
  error?: string;
  result?: {
    extractionId: string;
    initial: Record<string, unknown>;
    meta: Record<string, FieldMeta>;
    warning: string | null;
    qrExtras: Record<string, string>;
    fileName: string;
    usedModel: boolean;
    usedQr: boolean;
  };
};

/**
 * Reads one photo or PDF into a pre-filled form. The file is stored once (the confirmed document reuses
 * it); a QR code decoded in the browser comes along as text and its values win over the model's. Nothing
 * becomes part of the case until the adder confirms the form.
 */
export async function extractDocument(caseCode: string, type: DocType, _prev: ExtractState, formData: FormData): Promise<ExtractState> {
  if (!isDocType(type) || !DOC_FORMS[type]) return { error: "Unknown document type." };
  const me = await requireOnboardedUser();
  const c = await getCaseForUser(caseCode, me.id);
  if (!c) return { error: "You don't have access to this case." };
  if (!canAddDocument(me.role, type)) return { error: "Your account type can't add this document." };

  const file = fileOrNull(formData.get("file"));
  const bad = fileProblem(file, true);
  if (bad || !file) return { error: bad ?? "Choose a file." };
  const qrText = String(formData.get("qrText") ?? "").slice(0, 8000) || null;
  const qr = qrText ? parseQr(qrText) : null;
  const qrUseful = !!qr && qrAppliesTo(qr, type);

  if (!geminiConfigured() && !qrUseful) {
    return { error: "Reading from photos isn't switched on here (no Gemini API key), and no usable QR code was found. Type the details in instead." };
  }

  // The upload and the reading don't depend on each other, so they run together.
  const bytes = Buffer.from(await file.arrayBuffer());
  const [uploaded, reading] = await Promise.all([
    uploadCaseDocument(c.id, file).then(
      (u) => ({ ok: true as const, u }),
      (e: unknown) => ({ ok: false as const, e }),
    ),
    geminiConfigured() ? readWithGemini({ type, mimeType: file.type, bytes }) : Promise.resolve(null),
  ]);
  if (!uploaded.ok) {
    console.error("Upload for reading failed", uploaded.e);
    return { error: "The file couldn't be uploaded. Please try again." };
  }
  const upload = uploaded.u;

  if (reading && !reading.ok && !qrUseful) {
    await removeObjects([upload.path]).catch(() => {});
    return { error: reading.error };
  }
  const output = reading?.ok ? reading.output : null;
  const offered = offerFromReading(type, output, qr, new Date().toISOString().slice(0, 10));

  try {
    const [row] = await db
      .insert(documentExtraction)
      .values({
        caseId: c.id,
        userId: me.id,
        type,
        storagePath: upload.path,
        fileName: file.name.slice(0, 200),
        mimeType: file.type,
        sizeBytes: upload.size,
        sha256: upload.sha256,
        qrText,
        model: reading?.ok ? reading.model : null,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        output,
        offered,
      })
      .returning({ id: documentExtraction.id });
    await audit({
      actorId: me.id,
      action: "case.document_read",
      entityType: "case",
      entityId: c.id,
      details: { caseCode: c.caseCode, type, extractionId: row.id, model: reading?.ok ? reading.model : null, qr: qr?.kind ?? null, fileSha256: upload.sha256 },
    });
    return {
      result: {
        extractionId: row.id,
        initial: offered.initial,
        meta: offered.meta,
        warning: offered.warning ?? (reading && !reading.ok ? `${reading.error} The QR code's values are filled in below.` : null),
        qrExtras: offered.qrExtras,
        fileName: file.name,
        usedModel: !!reading?.ok,
        usedQr: qrUseful,
      },
    };
  } catch (e) {
    console.error("Saving the reading failed", e);
    await removeObjects([upload.path]).catch(() => {});
    return { error: "The reading couldn't be saved. Please try again." };
  }
}
