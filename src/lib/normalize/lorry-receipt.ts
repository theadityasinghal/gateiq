/**
 * Normaliser for the lorry receipt (LR) the transporter issues. One standard record with provenance,
 * like the shipping bill and e-way bill, so the vehicle and weight can be compared with them later.
 */
import { round, toIsoDate } from "./shipping-bill";
import { normalizeVehicleNumber } from "./eway-bill";

export type LorryReceiptInput = {
  lrNumber: string;
  lrDate: string;
  vehicleNumber: string;
  driverName?: string | null;
  /** E.164, already checked. */
  driverPhone?: string | null;
  fromPlace: string;
  toPlace: string;
  packages: number;
  goodsDescription: string;
  chargedWeight: number;
  weightUnit: "KGS" | "MTS";
};

export type NormalizedLorryReceipt = {
  documentNumber: string;
  documentDate: string;
  vehicleNumber: string;
  driver: { name: string | null; phone: string | null };
  route: { from: string; to: string };
  packages: number;
  goodsDescription: string;
  chargedWeightT: number;
};

const tidy = (v: string) => v.trim().replace(/\s+/g, " ");

export function normalizeLorryReceipt(input: LorryReceiptInput): { normalized: NormalizedLorryReceipt; provenance: Record<string, string> } {
  const provenance: Record<string, string> = {
    documentNumber: "input.lrNumber (uppercased, spaces removed)",
    documentDate: "input.lrDate (converted to ISO)",
    vehicleNumber: "input.vehicleNumber (uppercased, spaces and hyphens removed)",
    "driver.name": "input.driverName (spaces tidied)",
    "driver.phone": "input.driverPhone (E.164)",
    "route.from": "input.fromPlace (spaces tidied)",
    "route.to": "input.toPlace (spaces tidied)",
    chargedWeightT: `input.chargedWeight × ${input.weightUnit === "KGS" ? "0.001 (KGS → t)" : "1 (MTS)"}`,
  };
  const normalized: NormalizedLorryReceipt = {
    documentNumber: input.lrNumber.toUpperCase().replace(/\s/g, ""),
    documentDate: toIsoDate(input.lrDate),
    vehicleNumber: normalizeVehicleNumber(input.vehicleNumber),
    driver: { name: input.driverName ? tidy(input.driverName) : null, phone: input.driverPhone ?? null },
    route: { from: tidy(input.fromPlace), to: tidy(input.toPlace) },
    packages: input.packages,
    goodsDescription: tidy(input.goodsDescription),
    chargedWeightT: round(input.weightUnit === "KGS" ? input.chargedWeight / 1000 : input.chargedWeight, 3),
  };
  return { normalized, provenance };
}
