"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { caseSubmission, shipmentCase } from "@/db/schema";
import { ewayBillSchema, issuesToFieldErrors, lorryReceiptSchema, shippingBillSchema } from "@/lib/case-schema";
import { DOC_TYPES, canAddDocument, docLabelInline, isDocType, type DocType } from "@/lib/documents";
import { NormalizationError, normalizeShippingBill } from "@/lib/normalize/shipping-bill";
import { normalizeEwayBill } from "@/lib/normalize/eway-bill";
import { normalizeLorryReceipt } from "@/lib/normalize/lorry-receipt";
import { parsePhone } from "@/lib/phone";
import { ROLE_INFO } from "@/lib/roles";
import { requireOnboardedUser } from "@/server/session";
import { audit } from "@/server/audit";
import { getUnitFactors } from "@/server/masters";
import { ManualEwayBillSource, ManualFilingSource, ManualLorryReceiptSource } from "@/server/filings/manual";
import { checkAgainstMasters, fileOrNull, parsePayload } from "./form-helpers";
import { fileProblem, refreshCaseStatus, storeSubmission } from "./submission-store";
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

function done(caseCode: string): never {
  revalidatePath(`/cases/${caseCode}`);
  revalidatePath("/dashboard");
  redirect(`/cases/${caseCode}?tab=documents`);
}

export async function addShippingBill(caseCode: string, _prev: SubmissionFormState, formData: FormData): Promise<SubmissionFormState> {
  const g = await gate(caseCode, "shipping_bill");
  if ("error" in g) return { error: g.error };
  const { me, c } = g;

  const parsed = shippingBillSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const form = parsed.data;
  const file = fileOrNull(formData.get("file"));
  const bad = fileProblem(file);
  if (bad) return { fieldErrors: { file: bad } };

  const fieldErrors = await checkAgainstMasters({
    ports: [["portCode", form.portCode]],
    hsCodes: form.lines.map((l, i) => [`lines.${i}.hsCode`, l.hsCode]),
    uqc: form.lines.map((l, i) => [`lines.${i}.uqc`, l.uqc.toUpperCase()]),
    massUnits: [["weightUnit", form.weightUnit.toUpperCase()]],
    currencies: [["currency", form.currency.toUpperCase()]],
  });
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: fieldErrors._form };

  const received = await new ManualFilingSource().receive(form);
  let result;
  try {
    result = normalizeShippingBill(received.input, await getUnitFactors());
  } catch (e) {
    if (e instanceof NormalizationError) return { error: e.message };
    throw e;
  }

  await storeSubmission({
    caseId: c.id,
    caseCode: c.caseCode,
    type: "shipping_bill",
    actor: { id: me.id, role: me.role },
    source: received.source,
    documentNumber: result.normalized.documentNumber,
    documentDate: result.normalized.documentDate,
    raw: received.raw,
    normalized: result.normalized,
    provenance: result.provenance,
    file,
  });
  done(c.caseCode);
}

export async function addEwayBill(caseCode: string, _prev: SubmissionFormState, formData: FormData): Promise<SubmissionFormState> {
  const g = await gate(caseCode, "eway_bill");
  if ("error" in g) return { error: g.error };
  const { me, c } = g;

  const parsed = ewayBillSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const form = parsed.data;
  const file = fileOrNull(formData.get("file"));
  const bad = fileProblem(file);
  if (bad) return { fieldErrors: { file: bad } };

  const fieldErrors = await checkAgainstMasters({
    // HSN on an e-way bill can be 4 to 8 digits; only full ITC-HS codes can be checked against the master.
    hsCodes: form.lines.flatMap((l, i): Array<[string, string]> => (l.hsCode.length === 8 ? [[`lines.${i}.hsCode`, l.hsCode]] : [])),
    uqc: form.lines.map((l, i): [string, string] => [`lines.${i}.uqc`, l.uqc.toUpperCase()]),
  });
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: fieldErrors._form };

  const received = await new ManualEwayBillSource().receive(form);
  let result;
  try {
    result = normalizeEwayBill(received.input);
  } catch (e) {
    if (e instanceof NormalizationError) return { error: e.message };
    throw e;
  }

  await storeSubmission({
    caseId: c.id,
    caseCode: c.caseCode,
    type: "eway_bill",
    actor: { id: me.id, role: me.role },
    source: received.source,
    documentNumber: result.normalized.documentNumber,
    documentDate: result.normalized.documentDate,
    raw: received.raw,
    normalized: result.normalized,
    provenance: result.provenance,
    file,
  });
  done(c.caseCode);
}

export async function addLorryReceipt(caseCode: string, _prev: SubmissionFormState, formData: FormData): Promise<SubmissionFormState> {
  const g = await gate(caseCode, "lorry_receipt");
  if ("error" in g) return { error: g.error };
  const { me, c } = g;

  const parsed = lorryReceiptSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const form = parsed.data;
  const file = fileOrNull(formData.get("file"));
  const bad = fileProblem(file);
  if (bad) return { fieldErrors: { file: bad } };

  let driverPhone: string | null = null;
  if (form.driverPhone) {
    const phone = parsePhone(form.driverPhoneCountry, form.driverPhone);
    if (!phone.ok) return { fieldErrors: { driverPhone: phone.message } };
    driverPhone = phone.e164;
  }

  const received = await new ManualLorryReceiptSource().receive(form);
  let result;
  try {
    result = normalizeLorryReceipt({ ...received.input, driverPhone });
  } catch (e) {
    if (e instanceof NormalizationError) return { error: e.message };
    throw e;
  }

  await storeSubmission({
    caseId: c.id,
    caseCode: c.caseCode,
    type: "lorry_receipt",
    actor: { id: me.id, role: me.role },
    source: received.source,
    documentNumber: result.normalized.documentNumber,
    documentDate: result.normalized.documentDate,
    raw: received.raw,
    normalized: result.normalized,
    provenance: result.provenance,
    file,
  });
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

  await storeSubmission({
    caseId: c.id,
    caseCode: c.caseCode,
    type,
    actor: { id: me.id, role: me.role },
    source: "upload",
    documentNumber,
    documentDate,
    file,
  });
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
  revalidatePath(`/cases/${row.caseCode}`);
  revalidatePath("/dashboard");
}
