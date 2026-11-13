"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { caseGoodsLine, shipmentCase } from "@/db/schema";
import { generateCaseCode, normalizeCaseCode } from "@/lib/case-id";
import { caseSchema, issuesToFieldErrors } from "@/lib/case-schema";
import { getCurrentUser, requireOnboardedUser } from "@/server/session";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { deleteCasesCascade } from "./delete";
import { getOwnedCase } from "./service";
import { audit } from "@/server/audit";
import { ALLOWED_DOCUMENT_TYPES, MAX_TOTAL_UPLOAD_BYTES, removeObjects } from "@/server/storage";
import { checkAgainstMasters, fileOrNull, parsePayload } from "./form-helpers";
import { declareCaseRecordFacts } from "./facts-data";
import { storeSubmission } from "./submission-store";

export type CaseFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

async function requireConsignor() {
  const u = await getCurrentUser();
  if (!u) redirect("/sign-in");
  if (u.role !== "consignor") throw new Error("Only consignors can do this.");
  if (!u.hasProfile) redirect("/onboarding/profile");
  return u;
}



export async function createCase(_prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const me = await requireConsignor();
  const parsed = caseSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const data = parsed.data;

  const msds = fileOrNull(formData.get("msds"));
  const certificate = fileOrNull(formData.get("certificate"));
  const fieldErrors: Record<string, string> = {};
  if (data.hazmat && !msds) fieldErrors["hazmat.msds"] = "Hazardous cargo needs an MSDS.";
  for (const [key, f] of [["hazmat.msds", msds], ["perishable.certificate", certificate]] as const) {
    if (f && !(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(f.type)) fieldErrors[key] = "Upload a PDF, PNG or JPEG.";
  }
  if ((msds?.size ?? 0) + (certificate?.size ?? 0) > MAX_TOTAL_UPLOAD_BYTES) {
    fieldErrors["hazmat.msds"] = "Documents must be under 3.5 MB in total.";
  }

  Object.assign(
    fieldErrors,
    await checkAgainstMasters({
      ports: [["exportPortCode", data.exportPortCode]],
      hsCodes: data.lines.map((l, i) => [`lines.${i}.hsCode`, l.hsCode]),
      uqc: data.lines.map((l, i) => [`lines.${i}.uqc`, l.uqc.toUpperCase()]),
      massUnits: data.lines.map((l, i) => [`lines.${i}.weightUnit`, l.weightUnit.toUpperCase()]),
      currencies: [["currency", data.currency.toUpperCase()]],
      countries: [
        ["destinationCountry", data.destinationCountry.toUpperCase()],
      ],
    }),
  );
  if (Object.keys(fieldErrors).length) return { fieldErrors, error: fieldErrors._form };

  // Retry on the (astronomically unlikely) chance of a code collision.
  let created: { id: string; caseCode: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const caseCode = generateCaseCode();
    try {
      created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(shipmentCase)
          .values({
            caseCode,
            ownerId: me.id,
            status: "filing_pending",
            originPlace: data.originPlace,
            exportPortCode: data.exportPortCode,
            destinationCountry: data.destinationCountry.toUpperCase(),
            destinationPort: data.destinationPort ?? null,
            incoterm: data.incoterm,
            currency: data.currency.toUpperCase(),
            hazmat: data.hazmat,
            pharma: data.pharma,
            perishable: data.perishable,
          })
          .returning({ id: shipmentCase.id, caseCode: shipmentCase.caseCode });
        await tx.insert(caseGoodsLine).values(
          data.lines.map((l, i) => ({
            caseId: row.id,
            lineNo: i + 1,
            description: l.description,
            hsCode: l.hsCode,
            quantity: String(l.quantity),
            uqc: l.uqc.toUpperCase(),
            netWeight: String(l.netWeight),
            grossWeight: String(l.grossWeight),
            weightUnit: l.weightUnit.toUpperCase(),
            packages: l.packages,
            packageType: l.packageType,
            value: String(l.value),
          })),
        );
        await audit(
          { actorId: me.id, action: "case.created", entityType: "case", entityId: row.id, details: { caseCode, lines: data.lines.length } },
          tx,
        );
        // What the consignor declared becomes their declared facts; others can confirm them.
        await declareCaseRecordFacts(tx, {
          caseId: row.id,
          caseCode,
          owner: { id: me.id, role: "consignor" },
          record: {
            exportPortCode: data.exportPortCode,
            consigneeName: null,
            lines: data.lines.map((l) => ({ hsCode: l.hsCode, packages: l.packages, grossWeight: Number(l.grossWeight), weightUnit: l.weightUnit.toUpperCase() })),
          },
        });
        return row;
      });
    } catch (e) {
      const isCollision = e instanceof Error && /case_case_code_unique|duplicate key/.test(e.message);
      if (!isCollision) throw e;
    }
  }
  if (!created) return { error: "Could not create the case. Please try again." };

  // Documents go to private storage after the case exists; a failed upload doesn't lose the case.
  // Each becomes a submission by the consignor, like any document added later.
  try {
    const certType = data.perishable && /fumig/i.test(data.perishable.certificateType) ? "fumigation_certificate" : "quality_certificate";
    for (const [type, f] of [["msds", msds], [certType, certificate]] as const) {
      if (!f) continue;
      await storeSubmission({
        caseId: created.id,
        caseCode: created.caseCode,
        type,
        actor: { id: me.id, role: "consignor" },
        source: "upload",
        file: f,
      });
    }
  } catch (e) {
    console.error("Document upload failed", e);
    redirect(`/cases/${created.caseCode}?upload=failed`);
  }

  revalidatePath("/", "layout");
  redirect(`/cases/${created.caseCode}`);
}

/**
 * Deletes a case and everything on it. Only the consignor who owns it, and only after typing its Case ID.
 * The audit rows stay. The stored files are removed after the database commit.
 */
export async function deleteCase(caseCode: string, typedCode: string): Promise<ActionResult> {
  const me = await requireOnboardedUser();
  const c = await getOwnedCase(caseCode, me.id);
  if (!c) return fail("Only the consignor who owns this case can delete it.");
  if (normalizeCaseCode(typedCode) !== c.caseCode) return fail("Type the Case ID exactly to confirm.");
  let paths: string[] = [];
  await db.transaction(async (tx) => {
    paths = await deleteCasesCascade(tx, [c.id]);
    await audit({ actorId: me.id, action: "case.deleted", entityType: "case", entityId: c.id, details: { caseCode: c.caseCode, documents: paths.length } }, tx);
  });
  try {
    await removeObjects(paths);
  } catch (e) {
    console.error("deleteCase: could not remove stored documents", e);
  }
  revalidatePath("/", "layout");
  return ok;
}
