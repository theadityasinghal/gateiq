import "server-only";
import type { z } from "zod";
import {
  eSealSchema,
  ewayBillSchema,
  form13Schema,
  invoiceSchema,
  issuesToFieldErrors,
  lorryReceiptSchema,
  packingListSchema,
  shippingBillSchema,
  vgmSchema,
} from "@/lib/case-schema";
import type { DocType } from "@/lib/documents";
import { NormalizationError, normalizeShippingBill } from "@/lib/normalize/shipping-bill";
import { normalizeEwayBill } from "@/lib/normalize/eway-bill";
import { normalizeLorryReceipt } from "@/lib/normalize/lorry-receipt";
import { normalizeESeal, normalizeForm13, normalizeVgm } from "@/lib/normalize/port-docs";
import { normalizeInvoice, normalizePackingList } from "@/lib/normalize/commercial-docs";
import { parsePhone } from "@/lib/phone";
import { getUnitFactors } from "@/server/masters";
import { ManualFilingSource } from "@/server/filings/manual";
import { checkAgainstMasters } from "./form-helpers";

export type Normalized = { documentNumber: string; documentDate: string | null } & Record<string, unknown>;

/** What a handler produces: field errors to show, or the record to store. */
export type HandlerOutcome =
  | { fieldErrors?: Record<string, string>; error?: string; ok?: undefined }
  | { ok: true; form: unknown; input: unknown; normalized: Normalized; provenance: Record<string, string> };

type Run<F> = (form: F) => Promise<{ fieldErrors: Record<string, string>; error?: string } | { input: unknown; normalized: Normalized; provenance: Record<string, string> }>;

export type DocHandler = { run(payload: unknown): Promise<HandlerOutcome> };

/** Validates with the schema, runs the type's own checks and normaliser, and turns a NormalizationError into a form error. */
function handler<S extends z.ZodType>(schema: S, run: Run<z.infer<S>>): DocHandler {
  return {
    async run(payload) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error.issues) };
      try {
        const out = await run(parsed.data);
        if ("fieldErrors" in out) return out;
        return { ok: true, form: parsed.data, ...out };
      } catch (e) {
        if (e instanceof NormalizationError) return { error: e.message };
        throw e;
      }
    },
  };
}

const hasErrors = (e: Record<string, string>) => Object.keys(e).length > 0;
const hs8 = (lines: Array<{ hsCode: string }>) =>
  lines.flatMap((l, i): Array<[string, string]> => (l.hsCode.length === 8 ? [[`lines.${i}.hsCode`, l.hsCode]] : []));
const uqcs = (lines: Array<{ uqc: string }>) => lines.map((l, i): [string, string] => [`lines.${i}.uqc`, l.uqc.toUpperCase()]);

/** Every structured document type and how its form becomes a stored record. */
export const DOC_HANDLERS: Partial<Record<DocType, DocHandler>> = {
  shipping_bill: handler(shippingBillSchema, async (form) => {
    const fieldErrors = await checkAgainstMasters({
      ports: [["portCode", form.portCode]],
      hsCodes: form.lines.map((l, i) => [`lines.${i}.hsCode`, l.hsCode]),
      uqc: uqcs(form.lines),
      massUnits: [["weightUnit", form.weightUnit.toUpperCase()]],
      currencies: [["currency", form.currency.toUpperCase()]],
    });
    if (hasErrors(fieldErrors)) return { fieldErrors, error: fieldErrors._form };
    const received = await new ManualFilingSource().receive(form);
    return { input: received.input, ...normalizeShippingBill(received.input, await getUnitFactors()) };
  }),

  eway_bill: handler(ewayBillSchema, async (form) => {
    // HSN on an e-way bill can be 4 to 8 digits; only full ITC-HS codes can be checked against the master.
    const fieldErrors = await checkAgainstMasters({ hsCodes: hs8(form.lines), uqc: uqcs(form.lines) });
    if (hasErrors(fieldErrors)) return { fieldErrors, error: fieldErrors._form };
    return { input: form, ...normalizeEwayBill(form) };
  }),

  lorry_receipt: handler(lorryReceiptSchema, async (form) => {
    let driverPhone: string | null = null;
    if (form.driverPhone) {
      const phone = parsePhone(form.driverPhoneCountry, form.driverPhone);
      if (!phone.ok) return { fieldErrors: { driverPhone: phone.message } };
      driverPhone = phone.e164;
    }
    const input = { ...form, driverPhone };
    return { input, ...normalizeLorryReceipt(input) };
  }),

  form_13: handler(form13Schema, async (form) => ({ input: form, ...normalizeForm13(form) })),
  vgm_declaration: handler(vgmSchema, async (form) => ({ input: form, ...normalizeVgm(form) })),
  e_seal: handler(eSealSchema, async (form) => ({ input: form, ...normalizeESeal(form) })),

  commercial_invoice: handler(invoiceSchema, async (form) => {
    const fieldErrors = await checkAgainstMasters({
      hsCodes: hs8(form.lines),
      uqc: uqcs(form.lines),
      currencies: [["currency", form.currency]],
      countries: form.destinationCountry ? [["destinationCountry", form.destinationCountry]] : [],
    });
    if (hasErrors(fieldErrors)) return { fieldErrors, error: fieldErrors._form };
    return { input: form, ...normalizeInvoice(form) };
  }),

  packing_list: handler(packingListSchema, async (form) => ({ input: form, ...normalizePackingList(form) })),
};
