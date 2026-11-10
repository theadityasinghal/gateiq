/**
 * The facts GateIQ compares across documents, and how two values of each are compared.
 * A comparator answers 0 (the same), 1 (close: worth a look, not a hard mismatch) or 2 (different).
 */
import { describeSizeType } from "@/lib/iso6346";
import { normalizePartyName } from "@/lib/normalize/shipping-bill";
import type { ClaimValue, FactKey } from "./types";

export type Closeness = 0 | 1 | 2;
export type Comparator = (a: ClaimValue, b: ClaimValue) => Closeness;

const exact: Comparator = (a, b) => (String(a) === String(b) ? 0 : 2);

/** Invoice numbers: "INV/26/001" and "INV-26-001" are the same number written differently. */
const docNumber: Comparator = (a, b) => {
  const strip = (v: ClaimValue) => String(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (String(a).toUpperCase() === String(b).toUpperCase()) return 0;
  return strip(a) === strip(b) ? 1 : 2;
};

/** 22G1 and the legacy 2210 both mean a 20-foot standard box. */
const sizeType: Comparator = (a, b) => {
  if (a === b) return 0;
  const x = describeSizeType(String(a));
  const y = describeSizeType(String(b));
  if (!x || !y) return 2;
  if (x.lengthFt !== y.lengthFt || x.highCube !== y.highCube) return 2;
  // The legacy all-digit codes don't say the type; same length and height is the same box.
  return x.kind && y.kind && x.kind !== y.kind ? 2 : 0;
};

/** Weights in tonnes: within the tolerance is the same. */
const weight = (tolT: number, relative = 0): Comparator => (a, b) => {
  const x = Number(a);
  const y = Number(b);
  const tol = Math.max(tolT, relative * Math.max(x, y));
  return Math.abs(x - y) <= tol + 1e-9 ? 0 : 2;
};

/**
 * HS codes as sets. Codes are compared on their common prefix (an 8-digit ITC-HS against a 4-digit HSN),
 * and two sets agree when every code in each has a counterpart in the other.
 */
const hsSets: Comparator = (a, b) => {
  const xs = a as string[];
  const ys = b as string[];
  const match = (p: string, q: string) => {
    const n = Math.min(p.length, q.length);
    return n >= 4 && p.slice(0, n) === q.slice(0, n);
  };
  const covers = (from: string[], to: string[]) => from.every((p) => to.some((q) => match(p, q)));
  return covers(xs, ys) && covers(ys, xs) ? 0 : 2;
};

/** Party names after standardising suffixes; word overlap decides "close". */
const partyName: Comparator = (a, b) => {
  const x = normalizePartyName(String(a));
  const y = normalizePartyName(String(b));
  if (x === y) return 0;
  const drop = new Set(["PVT", "LTD", "CO", "CORP", "INC", "LLC", "FZE", "FZCO", "GMBH", "THE", "AND"]);
  const words = (s: string) => new Set(s.split(" ").filter((w) => w && !drop.has(w)));
  const xa = words(x);
  const ya = words(y);
  const inter = [...xa].filter((w) => ya.has(w)).length;
  const union = new Set([...xa, ...ya]).size || 1;
  const j = inter / union;
  return j >= 0.99 ? 0 : j >= 0.5 ? 1 : 2;
};

export type FactSpec = {
  label: string;
  scope: "case" | "container";
  compare: Comparator;
  /** Shown when sources disagree. */
  mismatch: string;
  /** Who usually fixes it, as advice (the owners shown are always the people whose documents disagree). */
};

export const FACTS: Record<FactKey, FactSpec> = {
  "container.number": { label: "Container number", scope: "container", compare: exact, mismatch: "The documents give different container numbers for the same container." },
  "container.sizeType": { label: "Size/type", scope: "container", compare: sizeType, mismatch: "The container's size or type differs." },
  "container.eSeal": { label: "E-seal number", scope: "container", compare: exact, mismatch: "The documents give different e-seal numbers." },
  "container.lineSeal": { label: "Line seal", scope: "container", compare: exact, mismatch: "The documents give different line seal numbers." },
  "container.vgm": { label: "VGM", scope: "container", compare: weight(0.1), mismatch: "The VGM differs between the Form-13 and the VGM declaration." },
  "vehicle.number": { label: "Vehicle", scope: "case", compare: exact, mismatch: "The documents name different trucks." },
  "sb.number": { label: "Shipping bill number", scope: "case", compare: exact, mismatch: "The shipping bill number differs." },
  "sb.date": { label: "Shipping bill date", scope: "case", compare: exact, mismatch: "The shipping bill date differs." },
  "booking.number": { label: "Booking number", scope: "case", compare: exact, mismatch: "The booking number differs." },
  "exporter.iec": { label: "Exporter IEC", scope: "case", compare: exact, mismatch: "The exporter's IEC differs." },
  "exporter.gstin": { label: "Exporter GSTIN", scope: "case", compare: exact, mismatch: "The exporter's GSTIN differs." },
  "invoice.number": { label: "Invoice number", scope: "case", compare: docNumber, mismatch: "The invoice number differs." },
  "invoice.date": { label: "Invoice date", scope: "case", compare: exact, mismatch: "The invoice date differs." },
  "goods.hsCodes": { label: "HS codes", scope: "case", compare: hsSets, mismatch: "The documents list different HS codes." },
  "goods.packages": { label: "Packages", scope: "case", compare: exact, mismatch: "The number of packages differs." },
  "goods.grossWeight": { label: "Gross weight", scope: "case", compare: weight(0.1, 0.02), mismatch: "The gross weight differs by more than 2% (or 100 kg)." },
  "consignee.name": { label: "Consignee", scope: "case", compare: partyName, mismatch: "The consignee's name differs." },
  "port.code": { label: "Port of export", scope: "case", compare: exact, mismatch: "The port of export differs." },
};
