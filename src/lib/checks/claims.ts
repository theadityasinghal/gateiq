/**
 * Turns each document's normalised record into claims: what it says about each fact. Container-scoped
 * claims are grouped into "mentions" so the engine can work out which mentions are the same container.
 */
import { DOC_TYPES, type DocType } from "@/lib/documents";
import type { Role } from "@/lib/roles";
import { formatContainerNo } from "@/lib/iso6346";
import type { NormalizedShippingBill } from "@/lib/normalize/shipping-bill";
import type { NormalizedEwayBill } from "@/lib/normalize/eway-bill";
import type { NormalizedLorryReceipt } from "@/lib/normalize/lorry-receipt";
import type { NormalizedESeal, NormalizedForm13, NormalizedVgm } from "@/lib/normalize/port-docs";
import type { NormalizedInvoice, NormalizedPackingList } from "@/lib/normalize/commercial-docs";
import type { Claim, ClaimValue, ContainerMention, FactKey, SourceRef } from "./types";

export type CheckSubmission = {
  id: string;
  type: DocType;
  addedByRole: Role;
  adderName: string;
  documentNumber: string | null;
  normalized: unknown;
};

/** The consignor's own case: what they declared when creating it. */
export type CheckCase = {
  exportPortCode: string;
  consigneeName: string | null;
  lines: Array<{ hsCode: string; packages: number; grossWeight: number; weightUnit: string }>;
};

export type Extracted = {
  claims: Claim[];
  mentions: ContainerMention[];
  /** Extra per-document facts for the hand-written checks. */
  vgms: Array<{ container: string; vgmT: number; tareT: number | null; source: SourceRef }>;
  sizeTypes: Array<{ container: string; code: string }>;
  ewbs: Array<{ validUntil: string | null; vehicle: string | null; source: SourceRef }>;
  sbGross: Array<{ grossT: number; source: SourceRef }>;
};

const t3 = (n: number) => `${n.toFixed(3)} t`;

function claim(fact: FactKey, value: ClaimValue | null | undefined, source: SourceRef, display?: string, loose?: boolean): Claim[] {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return [];
  return [{ fact, value, display: display ?? (Array.isArray(value) ? value.join(", ") : String(value)), source, loose }];
}

function mention(source: SourceRef, number: string | null, eSeal: string | null, extra: Claim[] = []): ContainerMention {
  const claims = [...claim("container.number", number, source, number ? formatContainerNo(number) : undefined), ...claim("container.eSeal", eSeal, source), ...extra];
  return { number, eSeal, source, claims };
}

export function sourceOf(s: CheckSubmission): SourceRef {
  return {
    submissionId: s.id,
    docType: s.type,
    label: `${DOC_TYPES[s.type].short}${s.documentNumber ? ` ${s.documentNumber}` : ""}`,
    role: s.addedByRole,
    adderName: s.adderName,
  };
}

/** KGS and MTS only; other units on the case are skipped rather than guessed. */
function caseTonnes(amount: number, unit: string): number | null {
  const u = unit.toUpperCase();
  return u === "KGS" ? amount / 1000 : u === "MTS" ? amount : null;
}

export function extractClaims(caseRecord: CheckCase, caseSource: SourceRef, submissions: CheckSubmission[]): Extracted {
  const out: Extracted = { claims: [], mentions: [], vgms: [], sizeTypes: [], ewbs: [], sbGross: [] };
  const push = (...c: Claim[][]) => out.claims.push(...c.flat());

  // The consignor's case record.
  push(
    claim("port.code", caseRecord.exportPortCode, caseSource),
    claim("consignee.name", caseRecord.consigneeName, caseSource),
    claim("goods.hsCodes", [...new Set(caseRecord.lines.map((l) => l.hsCode))].sort(), caseSource),
    claim("goods.packages", caseRecord.lines.reduce((s, l) => s + l.packages, 0) || null, caseSource),
  );
  const tonnes = caseRecord.lines.map((l) => caseTonnes(l.grossWeight, l.weightUnit));
  if (tonnes.length && tonnes.every((x) => x != null)) {
    const total = (tonnes as number[]).reduce((s, x) => s + x, 0);
    push(claim("goods.grossWeight", total, caseSource, t3(total)));
  }

  for (const s of submissions) {
    if (!s.normalized) continue; // a plain upload: nothing recorded to compare
    const src = sourceOf(s);
    switch (s.type) {
      case "shipping_bill": {
        const n = s.normalized as NormalizedShippingBill;
        push(
          claim("sb.number", n.documentNumber, src),
          claim("sb.date", n.documentDate, src),
          claim("port.code", n.portCode, src),
          claim("exporter.iec", n.exporter.iec, src),
          claim("exporter.gstin", n.exporter.gstin, src),
          claim("consignee.name", n.consigneeName, src),
          claim("goods.hsCodes", [...new Set(n.lines.map((l) => l.hsCode))].sort(), src),
          claim("goods.packages", n.totals.packages, src),
          claim("goods.grossWeight", n.totals.grossWeightT, src, t3(n.totals.grossWeightT)),
        );
        out.sbGross.push({ grossT: n.totals.grossWeightT, source: src });
        for (const k of n.containers ?? []) {
          out.mentions.push(mention(src, k.number, k.sealNo, claim("container.sizeType", k.sizeType, src)));
          if (k.sizeType) out.sizeTypes.push({ container: k.number, code: k.sizeType });
        }
        break;
      }
      case "eway_bill": {
        const n = s.normalized as NormalizedEwayBill;
        push(
          claim("exporter.gstin", n.from.gstin, src),
          claim("vehicle.number", n.transport.vehicleNumber, src),
          claim("goods.hsCodes", [...new Set(n.lines.map((l) => l.hsCode))].sort(), src),
        );
        if (n.invoice.type === "INV") push(claim("invoice.number", n.invoice.number, src), claim("invoice.date", n.invoice.date, src));
        out.ewbs.push({ validUntil: n.validUntil, vehicle: n.transport.vehicleNumber, source: src });
        break;
      }
      case "lorry_receipt": {
        const n = s.normalized as NormalizedLorryReceipt;
        push(
          claim("vehicle.number", n.vehicleNumber, src),
          claim("goods.packages", n.packages, src),
          // Charged weight is often rounded up for billing: it only warns.
          claim("goods.grossWeight", n.chargedWeightT, src, `${t3(n.chargedWeightT)} (charged)`, true),
        );
        for (const k of n.containerNumbers ?? []) out.mentions.push(mention(src, k, null));
        break;
      }
      case "form_13": {
        const n = s.normalized as NormalizedForm13;
        push(claim("booking.number", n.bookingNo, src), claim("sb.number", n.sbNumber, src), claim("vehicle.number", n.vehicleNumber, src));
        out.mentions.push(
          mention(src, n.container.number, n.container.eSeal, [
            ...claim("container.sizeType", n.container.isoCode, src),
            ...claim("container.lineSeal", n.container.lineSeal, src),
            ...claim("container.vgm", n.vgmT, src, t3(n.vgmT)),
          ]),
        );
        out.vgms.push({ container: n.container.number, vgmT: n.vgmT, tareT: null, source: src });
        if (n.container.isoCode) out.sizeTypes.push({ container: n.container.number, code: n.container.isoCode });
        break;
      }
      case "vgm_declaration": {
        const n = s.normalized as NormalizedVgm;
        push(claim("booking.number", n.bookingNo, src), claim("exporter.iec", n.shipperIec, src));
        for (const k of n.containers) {
          out.mentions.push(mention(src, k.number, null, claim("container.vgm", k.vgmT, src, t3(k.vgmT))));
          out.vgms.push({ container: k.number, vgmT: k.vgmT, tareT: k.tareT, source: src });
        }
        break;
      }
      case "e_seal": {
        const n = s.normalized as NormalizedESeal;
        push(claim("sb.number", n.sbNumber, src), claim("sb.date", n.sbDate, src), claim("exporter.iec", n.iec, src), claim("vehicle.number", n.truckNumber, src));
        out.mentions.push(mention(src, n.containerNumber, n.eSealNo));
        break;
      }
      case "commercial_invoice": {
        const n = s.normalized as NormalizedInvoice;
        push(
          claim("invoice.number", n.documentNumber, src),
          claim("invoice.date", n.documentDate, src),
          claim("exporter.gstin", n.exporterGstin, src),
          claim("consignee.name", n.buyerName, src),
          claim("goods.hsCodes", [...new Set(n.lines.map((l) => l.hsCode))].sort(), src),
        );
        break;
      }
      case "packing_list": {
        const n = s.normalized as NormalizedPackingList;
        push(
          claim("invoice.number", n.documentNumber, src),
          claim("invoice.date", n.documentDate, src),
          claim("goods.packages", n.totals.packages, src),
          claim("goods.grossWeight", n.totals.grossWeightT, src, t3(n.totals.grossWeightT)),
        );
        for (const k of n.containerNumbers) out.mentions.push(mention(src, k, null));
        break;
      }
      default:
        break;
    }
  }
  return out;
}
