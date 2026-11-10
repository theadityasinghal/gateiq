/**
 * Reads the QR codes printed on Indian trade documents into form fields. Values from a QR code are exact
 * (no reading errors), so they take precedence over what the vision model reads from the same page.
 *
 * - GST e-invoice: the signed QR is a JWT issued by the IRP. Its payload carries `data`, a JSON string with
 *   SellerGstin, BuyerGstin, DocNo, DocTyp, DocDt (dd/mm/yyyy), TotInvVal, ItemCnt, MainHsnCode, Irn, IrnDt.
 *   The signature is not verified here (that needs the IRP's public key); the UI says so.
 * - E-way bill: the printout's QR carries the EWB number, the generator's GSTIN and the generation date.
 *   Its exact layout isn't published, so it is read defensively by pattern.
 */
import type { DocType } from "@/lib/documents";

export type QrReading = {
  kind: "e_invoice" | "eway_bill" | "unknown";
  /** Form values for the document type the QR belongs to, keyed like the form. */
  values: Record<string, string>;
  /** Anything worth showing that has no form field (e.g. the invoice total). */
  extras: Record<string, string>;
  signatureChecked: false;
};

const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/;

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  if (typeof atob === "function") {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

/** dd/mm/yyyy (or dd-mm-yyyy) → yyyy-mm-dd; anything else → null. */
export function qrDateToIso(s: string | undefined | null): string | null {
  const m = s?.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseEInvoice(text: string): QrReading | null {
  const parts = text.trim().split(".");
  if (parts.length !== 3) return null;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
  let data: Record<string, unknown> = payload;
  if (typeof payload.data === "string") {
    try {
      data = JSON.parse(payload.data);
    } catch {
      return null;
    }
  } else if (payload.data && typeof payload.data === "object") {
    data = payload.data as Record<string, unknown>;
  }
  if (typeof data.Irn !== "string" && typeof data.DocNo !== "string") return null;
  const str = (k: string) => (data[k] == null ? "" : String(data[k]).trim());
  const values: Record<string, string> = {};
  if (str("DocNo")) values.invoiceNumber = str("DocNo").toUpperCase();
  const date = qrDateToIso(str("DocDt"));
  if (date) values.invoiceDate = date;
  if (GSTIN.test(str("SellerGstin"))) values.exporterGstin = str("SellerGstin");
  if (/^[0-9a-f]{64}$/i.test(str("Irn"))) values.irn = str("Irn").toLowerCase();
  const extras: Record<string, string> = {};
  for (const [k, label] of [
    ["DocTyp", "Document type"],
    ["BuyerGstin", "Buyer GSTIN"],
    ["TotInvVal", "Invoice total (INR)"],
    ["ItemCnt", "Number of items"],
    ["MainHsnCode", "Main HSN code"],
    ["IrnDt", "IRN generated"],
  ] as const) {
    if (str(k)) extras[label] = str(k);
  }
  return { kind: "e_invoice", values, extras, signatureChecked: false };
}

function parseEwayBill(text: string): QrReading | null {
  const t = text.trim();
  const ewb = t.match(/(?<!\d)(\d{12})(?!\d)/);
  if (!ewb) return null;
  // Must look like an e-way bill QR, not any 12-digit number: a GSTIN or "EWB" alongside it.
  const gstin = t.match(GSTIN);
  if (!gstin && !/EWB|E-?WAY/i.test(t)) return null;
  const values: Record<string, string> = { ewbNumber: ewb[1] };
  if (gstin) values.fromGstin = gstin[0];
  const date = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  const iso = date ? qrDateToIso(date[0]) : null;
  if (iso) values.ewbDate = iso;
  return { kind: "eway_bill", values, extras: {}, signatureChecked: false };
}

export function parseQr(text: string): QrReading {
  return parseEInvoice(text) ?? parseEwayBill(text) ?? { kind: "unknown", values: {}, extras: {}, signatureChecked: false };
}

/** Which document type a QR reading fills in. A GST e-invoice QR fills the commercial invoice. */
export function qrAppliesTo(reading: QrReading, type: DocType): boolean {
  return (reading.kind === "e_invoice" && type === "commercial_invoice") || (reading.kind === "eway_bill" && type === "eway_bill");
}
