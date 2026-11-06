"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import {
  caseDocument,
  caseGoodsLine,
  filedBaseline,
  filing,
  filingRawRecord,
  shipmentCase,
} from "@/db/schema";
import { generateCaseCode } from "@/lib/case-id";
import { caseSchema, issuesToFieldErrors, shippingBillSchema } from "@/lib/case-schema";
import { canonicalJson } from "@/lib/canonical-json";
import { NormalizationError, normalizeShippingBill } from "@/lib/normalize/shipping-bill";
import { getCurrentUser } from "@/server/session";
import { audit } from "@/server/audit";
import {
  countryMaster,
  currencyMaster,
  hsCodeMaster,
  portMaster,
  uqcMaster,
} from "@/db/schema";
import { getUnitFactors, masterStatus } from "@/server/masters";
import { ALLOWED_DOCUMENT_TYPES, MAX_TOTAL_UPLOAD_BYTES, removeObjects, uploadCaseDocument } from "@/server/storage";
import { ManualFilingSource } from "@/server/filings/manual";
import { getOwnedCase } from "./service";

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

function parsePayload(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Checks codes against the reference masters. A master that hasn't been imported is skipped, not failed. */
async function checkAgainstMasters(checks: {
  ports?: Array<[string, string]>;
  hsCodes?: Array<[string, string]>; // [fieldKey, code]
  uqc?: Array<[string, string]>;
  massUnits?: Array<[string, string]>;
  currencies?: Array<[string, string]>;
  countries?: Array<[string, string]>;
}): Promise<Record<string, string>> {
  const status = await masterStatus();
  const errors: Record<string, string> = {};
  const lookup = async <T>(rows: Array<[string, string]> | undefined, loaded: number, fetch: (codes: string[]) => Promise<T[]>, key: (r: T) => string, message: (c: string) => string) => {
    if (!rows?.length || loaded === 0) return;
    const found = new Set((await fetch([...new Set(rows.map((r) => r[1]))])).map(key));
    for (const [field, code] of rows) if (!found.has(code)) errors[field] = message(code);
  };
  await lookup(
    checks.ports,
    status.ports,
    (codes) => db.select({ code: portMaster.code }).from(portMaster).where(inArray(portMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not in the customs location master.`,
  );
  await lookup(
    checks.hsCodes,
    status.hsCodes,
    (codes) => db.select({ code: hsCodeMaster.code }).from(hsCodeMaster).where(inArray(hsCodeMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not in the ITC-HS master.`,
  );
  if (status.uqc === 0 && (checks.massUnits?.length || checks.uqc?.length)) {
    errors._form = "Unit reference data (UQC) has not been imported yet. Run npm run masters:import.";
  }
  await lookup(
    checks.uqc,
    status.uqc,
    (codes) => db.select({ code: uqcMaster.code }).from(uqcMaster).where(inArray(uqcMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not a UQC unit.`,
  );
  await lookup(
    checks.massUnits,
    status.uqc,
    (codes) =>
      db.select({ code: uqcMaster.code, f: uqcMaster.tonnesFactor }).from(uqcMaster).where(inArray(uqcMaster.code, codes)),
    (r) => (r.f == null ? "" : r.code),
    (c) => `${c} is not a unit of weight.`,
  );
  await lookup(
    checks.currencies,
    status.currencies,
    (codes) => db.select({ code: currencyMaster.code }).from(currencyMaster).where(inArray(currencyMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not an ISO 4217 currency.`,
  );
  await lookup(
    checks.countries,
    status.countries,
    (codes) => db.select({ code: countryMaster.code }).from(countryMaster).where(inArray(countryMaster.code, codes)),
    (r) => r.code,
    (c) => `${c} is not an ISO 3166 country.`,
  );
  return errors;
}

function fileOrNull(v: FormDataEntryValue | null): File | null {
  return v instanceof File && v.size > 0 ? v : null;
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
        ["consigneeCountry", data.consigneeCountry.toUpperCase()],
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
            consigneeName: data.consigneeName,
            consigneeAddress: data.consigneeAddress,
            consigneeCountry: data.consigneeCountry.toUpperCase(),
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
        return row;
      });
    } catch (e) {
      const isCollision = e instanceof Error && /case_case_code_unique|duplicate key/.test(e.message);
      if (!isCollision) throw e;
    }
  }
  if (!created) return { error: "Could not create the case. Please try again." };

  // Documents go to private storage after the case exists; a failed upload doesn't lose the case.
  const uploaded: string[] = [];
  try {
    for (const [kind, f] of [["msds", msds], ["certificate", certificate]] as const) {
      if (!f) continue;
      const u = await uploadCaseDocument(created.id, f);
      uploaded.push(u.path);
      await db.insert(caseDocument).values({
        caseId: created.id,
        kind,
        storagePath: u.path,
        fileName: f.name.slice(0, 200),
        mimeType: f.type,
        sizeBytes: u.size,
        sha256: u.sha256,
        uploadedBy: me.id,
      });
      await audit({ actorId: me.id, action: "case.document_uploaded", entityType: "case", entityId: created.id, details: { kind, sha256: u.sha256 } });
    }
  } catch (e) {
    await removeObjects(uploaded).catch(() => {});
    await db.delete(caseDocument).where(eq(caseDocument.caseId, created.id));
    console.error("Document upload failed", e);
    redirect(`/cases/${created.caseCode}?upload=failed`);
  }

  revalidatePath("/dashboard");
  redirect(`/cases/${created.caseCode}`);
}

export async function recordShippingBill(caseCode: string, _prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const me = await requireConsignor();
  const c = await getOwnedCase(caseCode, me.id);
  if (!c) return { error: "Case not found." };

  const parsed = shippingBillSchema.safeParse(parsePayload(formData));
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
  const form = parsed.data;

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

  const rawJson = canonicalJson(received.raw);
  const sha256 = createHash("sha256").update(rawJson).digest("hex");

  const version = await db.transaction(async (tx) => {
    const [f] = await tx
      .insert(filing)
      .values({
        caseId: c.id,
        kind: "shipping_bill",
        documentNumber: result.normalized.documentNumber,
        documentDate: result.normalized.documentDate,
        portCode: result.normalized.portCode,
        source: received.source,
      })
      .onConflictDoUpdate({
        target: [filing.caseId, filing.kind],
        set: {
          documentNumber: result.normalized.documentNumber,
          documentDate: result.normalized.documentDate,
          portCode: result.normalized.portCode,
          source: received.source,
        },
      })
      .returning({ id: filing.id });
    const [raw] = await tx
      .insert(filingRawRecord)
      .values({ filingId: f.id, source: received.source, payload: received.raw, sha256, receivedBy: me.id })
      .returning({ id: filingRawRecord.id });
    const [{ v }] = await tx.select({ v: max(filedBaseline.version) }).from(filedBaseline).where(eq(filedBaseline.filingId, f.id));
    const next = (v ?? 0) + 1;
    await tx.insert(filedBaseline).values({
      filingId: f.id,
      rawRecordId: raw.id,
      version: next,
      verification: received.verification,
      normalized: result.normalized,
      provenance: result.provenance,
    });
    await tx.update(shipmentCase).set({ status: "filed_baseline_ready", updatedAt: new Date() }).where(eq(shipmentCase.id, c.id));
    await audit(
      {
        actorId: me.id,
        action: next === 1 ? "filing.baseline_created" : "filing.baseline_revised",
        entityType: "case",
        entityId: c.id,
        details: { source: received.source, version: next, sha256, sbNumber: result.normalized.documentNumber },
      },
      tx,
    );
    return next;
  });

  revalidatePath(`/cases/${c.caseCode}`);
  redirect(`/cases/${c.caseCode}?tab=diff&v=${version}`);
}
