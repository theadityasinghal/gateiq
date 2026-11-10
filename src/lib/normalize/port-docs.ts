/**
 * Normalisers for the port-side papers of a factory-stuffed container: e-Form-13, the VGM declaration and
 * the RFID e-seal record. Same contract as the others: one standard record plus where each field came from.
 * Weights are in tonnes, IDs are letters and digits only, dates are ISO.
 */
import type { ESealFormInput, Form13FormInput, VgmFormInput } from "@/lib/case-schema";
import { alnum, normalizePartyName, round, toIsoDate } from "./shipping-bill";
import { normalizeVehicleNumber } from "./eway-bill";

type Result<N> = { normalized: N; provenance: Record<string, string> };

export type NormalizedForm13 = {
  documentNumber: string; // booking number; Form-13 has no number of its own
  documentDate: string | null;
  bookingNo: string;
  container: { number: string; isoCode: string | null; lineSeal: string | null; eSeal: string | null };
  vgmT: number;
  sbNumber: string | null;
  chaLicence: string | null;
  shipperName: string | null;
  pod: string | null;
  vesselCall: string | null;
  vehicleNumber: string | null;
};

export function normalizeForm13(input: Form13FormInput): Result<NormalizedForm13> {
  const provenance: Record<string, string> = {
    documentNumber: "input.bookingNo (letters and digits only)",
    "container.number": "input.containerNo (letters and digits only)",
    "container.lineSeal": "input.lineSealNo",
    "container.eSeal": "input.eSealNo",
    vgmT: `input.vgm (${input.vgmUnit} → t)`,
    shipperName: "input.shipperName (case-folded, suffixes standardised)",
    vehicleNumber: "input.vehicleNumber (uppercased, spaces and hyphens removed)",
  };
  return {
    normalized: {
      documentNumber: alnum(input.bookingNo),
      documentDate: input.issuedOn ? toIsoDate(input.issuedOn) : null,
      bookingNo: alnum(input.bookingNo),
      container: {
        number: alnum(input.containerNo),
        isoCode: input.isoCode ? alnum(input.isoCode) : null,
        lineSeal: input.lineSealNo ? alnum(input.lineSealNo) : null,
        eSeal: input.eSealNo ? alnum(input.eSealNo) : null,
      },
      vgmT: round(input.vgmUnit === "KGS" ? input.vgm / 1000 : input.vgm, 3),
      sbNumber: input.sbNumber?.trim() ?? null,
      chaLicence: input.chaLicence?.trim().toUpperCase() ?? null,
      shipperName: input.shipperName ? normalizePartyName(input.shipperName) : null,
      pod: input.pod ? alnum(input.pod) : null,
      vesselCall: input.vesselCall?.trim().toUpperCase() ?? null,
      vehicleNumber: input.vehicleNumber ? normalizeVehicleNumber(input.vehicleNumber) : null,
    },
    provenance,
  };
}

export type NormalizedVgm = {
  documentNumber: string; // weighing slip number, else booking number
  documentDate: string;
  bookingNo: string;
  shipperName: string;
  shipperIec: string | null;
  method: "1" | "2";
  weighbridgeRegNo: string | null;
  containers: Array<{ number: string; vgmT: number; tareT: number | null }>;
};

export function normalizeVgm(input: VgmFormInput): Result<NormalizedVgm> {
  const provenance: Record<string, string> = {
    documentNumber: input.weighingSlipNo ? "input.weighingSlipNo" : "input.bookingNo (no weighing slip number given)",
    documentDate: "input.weighedOn (converted to ISO)",
    shipperName: "input.shipperName (case-folded, suffixes standardised)",
  };
  const containers = input.containers.map((c, i) => {
    provenance[`containers[${i}].vgmT`] = `input.containers[${i}].vgmKg ÷ 1000`;
    if (c.tareKg != null) provenance[`containers[${i}].tareT`] = `input.containers[${i}].tareKg ÷ 1000`;
    return { number: alnum(c.containerNo), vgmT: round(c.vgmKg / 1000, 3), tareT: c.tareKg != null ? round(c.tareKg / 1000, 3) : null };
  });
  return {
    normalized: {
      documentNumber: input.weighingSlipNo ? input.weighingSlipNo.trim().toUpperCase() : alnum(input.bookingNo),
      documentDate: toIsoDate(input.weighedOn),
      bookingNo: alnum(input.bookingNo),
      shipperName: normalizePartyName(input.shipperName),
      shipperIec: input.shipperIec ? alnum(input.shipperIec) : null,
      method: input.method,
      weighbridgeRegNo: input.weighbridgeRegNo?.trim().toUpperCase() ?? null,
      containers,
    },
    provenance,
  };
}

export type NormalizedESeal = {
  documentNumber: string; // the e-seal number
  documentDate: string; // date of sealing
  eSealNo: string;
  containerNumber: string;
  sbNumber: string;
  sbDate: string;
  iec: string;
  truckNumber: string | null;
};

export function normalizeESeal(input: ESealFormInput): Result<NormalizedESeal> {
  return {
    normalized: {
      documentNumber: alnum(input.eSealNo),
      documentDate: toIsoDate(input.sealedOn),
      eSealNo: alnum(input.eSealNo),
      containerNumber: alnum(input.containerNo),
      sbNumber: input.sbNumber.trim(),
      sbDate: toIsoDate(input.sbDate),
      iec: alnum(input.iec),
      truckNumber: input.truckNumber ? normalizeVehicleNumber(input.truckNumber) : null,
    },
    provenance: {
      documentNumber: "input.eSealNo (letters and digits only)",
      documentDate: "input.sealedOn (converted to ISO)",
      containerNumber: "input.containerNo (letters and digits only)",
      truckNumber: "input.truckNumber (uppercased, spaces and hyphens removed)",
    },
  };
}
