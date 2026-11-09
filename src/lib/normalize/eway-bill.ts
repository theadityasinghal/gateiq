/**
 * Normaliser for the e-way bill (GST portal). Same idea as the shipping bill: one standard
 * record from any source (manual form now, the NIC e-way bill API later), with provenance.
 */
import { round, toIsoDate } from "./shipping-bill";

export type EwayBillInput = {
  ewbNumber: string;
  ewbDate: string;
  validUntil?: string | null;
  fromGstin: string;
  toGstin: string; // a GSTIN, or URP for an unregistered / overseas recipient
  fromPincode: string;
  toPincode: string;
  docType: string;
  docNumber: string;
  docDate: string;
  transportMode: string;
  distanceKm: number;
  transporterId?: string | null;
  vehicleNumber?: string | null; // Part B; may be added later
  lines: Array<{ description: string; hsCode: string; quantity: number; uqc: string; value: number }>;
};

export type NormalizedEwayBill = {
  documentNumber: string;
  documentDate: string;
  validUntil: string | null;
  from: { gstin: string; pincode: string };
  to: { gstin: string; pincode: string };
  invoice: { type: string; number: string; date: string };
  transport: { mode: string; distanceKm: number; transporterId: string | null; vehicleNumber: string | null };
  totals: { value: number };
  lines: Array<{ lineNo: number; description: string; hsCode: string; quantity: number; uqc: string; value: number }>;
};

/** Upper-cases and strips spaces and hyphens: "mh 04-ab 1234" → "MH04AB1234". */
export function normalizeVehicleNumber(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "");
}

const compact = (v: string) => v.toUpperCase().replace(/[\s-]/g, "");

export function normalizeEwayBill(input: EwayBillInput): { normalized: NormalizedEwayBill; provenance: Record<string, string> } {
  const provenance: Record<string, string> = {
    documentNumber: "input.ewbNumber (spaces removed)",
    documentDate: "input.ewbDate (converted to ISO)",
    validUntil: "input.validUntil (converted to ISO)",
    "from.gstin": "input.fromGstin (uppercased)",
    "to.gstin": "input.toGstin (uppercased; URP = unregistered)",
    "invoice.number": "input.docNumber (uppercased)",
    "invoice.date": "input.docDate (converted to ISO)",
    "transport.vehicleNumber": "input.vehicleNumber (uppercased, spaces and hyphens removed)",
    "totals.value": "sum of input.lines[].value",
  };
  const lines = input.lines.map((l, i) => ({
    lineNo: i + 1,
    description: l.description.trim().replace(/\s+/g, " "),
    hsCode: l.hsCode.replace(/[\s.]/g, ""),
    quantity: round(l.quantity, 3),
    uqc: l.uqc.toUpperCase(),
    value: round(l.value, 2),
  }));
  const normalized: NormalizedEwayBill = {
    documentNumber: input.ewbNumber.replace(/\s/g, ""),
    documentDate: toIsoDate(input.ewbDate),
    validUntil: input.validUntil ? toIsoDate(input.validUntil) : null,
    from: { gstin: compact(input.fromGstin), pincode: input.fromPincode.trim() },
    to: { gstin: compact(input.toGstin), pincode: input.toPincode.trim() },
    invoice: { type: input.docType.toUpperCase(), number: input.docNumber.trim().toUpperCase(), date: toIsoDate(input.docDate) },
    transport: {
      mode: input.transportMode.toUpperCase(),
      distanceKm: input.distanceKm,
      transporterId: input.transporterId ? compact(input.transporterId) : null,
      vehicleNumber: input.vehicleNumber ? normalizeVehicleNumber(input.vehicleNumber) : null,
    },
    totals: { value: round(lines.reduce((s, l) => s + l.value, 0), 2) },
    lines,
  };
  return { normalized, provenance };
}
