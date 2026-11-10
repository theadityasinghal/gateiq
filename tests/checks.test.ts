import { describe, expect, it } from "vitest";
import { linkContainers, runChecks, type CheckSubmission } from "@/lib/checks/engine";
import type { ContainerMention, SourceRef } from "@/lib/checks/types";

const GOOD = "CSQU3054383";
const TYPO = "CSQU3045383"; // two digits swapped: fails the check digit

const caseRecord = {
  exportPortCode: "INNSA1",
  consigneeName: "Gulf Traders LLC",
  lines: [{ hsCode: "39011010", packages: 40, grossWeight: 12500, weightUnit: "KGS" }],
};
const owner = { role: "consignor" as const, name: "Asha" };

const sb = (containerNo: string): CheckSubmission => ({
  id: "sb1",
  type: "shipping_bill",
  addedByRole: "cha",
  adderName: "Ravi",
  documentNumber: "1234567",
  normalized: {
    documentNumber: "1234567",
    documentDate: "2026-11-01",
    portCode: "INNSA1",
    exporter: { iec: "ABCDE1234F", gstin: "27ABCDE1234F1Z5" },
    consigneeName: "GULF TRADERS LLC",
    currency: "USD",
    totals: { packages: 40, grossWeightT: 12.5, netWeightT: 12, value: 15000 },
    lines: [{ lineNo: 1, description: "Granules", hsCode: "39011010", quantity: 12000, uqc: "KGS", value: 15000 }],
    containers: [{ number: containerNo, sizeType: "22G1", sealNo: "ABCD12345678" }],
  },
});

const form13: CheckSubmission = {
  id: "f13",
  type: "form_13",
  addedByRole: "transporter",
  adderName: "Kiran",
  documentNumber: "BOM123",
  normalized: {
    documentNumber: "BOM123",
    documentDate: null,
    bookingNo: "BOM123",
    container: { number: GOOD, isoCode: "2210", lineSeal: "ML1", eSeal: "ABCD12345678" },
    vgmT: 14.8,
    sbNumber: "1234567",
    chaLicence: null,
    shipperName: null,
    pod: null,
    vesselCall: null,
    vehicleNumber: null,
  },
};

const eseal: CheckSubmission = {
  id: "seal",
  type: "e_seal",
  addedByRole: "consignor",
  adderName: "Asha",
  documentNumber: "ABCD12345678",
  normalized: {
    documentNumber: "ABCD12345678",
    documentDate: "2026-11-02",
    eSealNo: "ABCD12345678",
    containerNumber: GOOD,
    sbNumber: "1234567",
    sbDate: "2026-11-01",
    iec: "ABCDE1234F",
    truckNumber: "MH04AB1234",
  },
};

const ewb = (vehicle: string | null, validUntil: string | null): CheckSubmission => ({
  id: "ewb",
  type: "eway_bill",
  addedByRole: "consignor",
  adderName: "Asha",
  documentNumber: "123412341234",
  normalized: {
    documentNumber: "123412341234",
    documentDate: "2026-11-02",
    validUntil,
    from: { gstin: "27ABCDE1234F1Z5", pincode: "421302" },
    to: { gstin: "URP", pincode: "400707" },
    invoice: { type: "INV", number: "INV/26/001", date: "2026-10-30" },
    transport: { mode: "ROAD", distanceKm: 60, transporterId: null, vehicleNumber: vehicle },
    totals: { value: 1200000 },
    lines: [{ lineNo: 1, description: "Granules", hsCode: "3901", quantity: 12000, uqc: "KGS", value: 1200000 }],
  },
});

const lr = (vehicle: string, chargedWeightT = 12.5): CheckSubmission => ({
  id: "lr",
  type: "lorry_receipt",
  addedByRole: "transporter",
  adderName: "Kiran",
  documentNumber: "LR1",
  normalized: {
    documentNumber: "LR1",
    documentDate: "2026-11-02",
    vehicleNumber: vehicle,
    driver: { name: null, phone: null },
    route: { from: "Bhiwandi", to: "JNPT" },
    packages: 40,
    goodsDescription: "Granules",
    chargedWeightT,
    containerNumbers: [GOOD],
  },
});

const vgm = (vgmKg: number, tareKg: number | null): CheckSubmission => ({
  id: "vgm",
  type: "vgm_declaration",
  addedByRole: "consignor",
  adderName: "Asha",
  documentNumber: "WS1",
  normalized: {
    documentNumber: "WS1",
    documentDate: "2026-11-02",
    bookingNo: "BOM123",
    shipperName: "ACME",
    shipperIec: "ABCDE1234F",
    method: "1",
    weighbridgeRegNo: null,
    containers: [{ number: GOOD, vgmT: vgmKg / 1000, tareT: tareKg == null ? null : tareKg / 1000 }],
  },
});

const find = (r: ReturnType<typeof runChecks>, fact: string) =>
  [...r.containers.flatMap((c) => c.results), ...r.caseChecks].filter((x) => x.fact === fact);

describe("cross-document checks", () => {
  it("all agree on a clean case", () => {
    const r = runChecks({ caseRecord, caseOwner: owner, submissions: [sb(GOOD), form13, eseal, ewb("MH04AB1234", "2026-11-12"), lr("MH04AB1234"), vgm(14700, 2200)], today: "2026-11-09" });
    expect(r.containers).toHaveLength(1);
    expect(r.counts).toEqual({ mismatch: 0, warning: 0, invalid: 0, acknowledged: 0 });
    expect(find(r, "container.number")[0].status).toBe("agree");
    expect(find(r, "container.sizeType")[0].status).toBe("agree"); // 22G1 and legacy 2210 are the same box
    expect(find(r, "derived.vgmVsGross")[0].status).toBe("agree");
    expect(find(r, "goods.hsCodes")[0].status).toBe("agree"); // 3901 on the e-way bill covers 39011010
  });

  it("links a typo'd container on the shipping bill to the others through the seal, and flags it twice", () => {
    const r = runChecks({ caseRecord, caseOwner: owner, submissions: [sb(TYPO), form13, eseal], today: "2026-11-09" });
    expect(r.containers).toHaveLength(1);
    expect(r.containers[0].id).toBe(GOOD);
    const num = find(r, "container.number")[0];
    expect(num.status).toBe("mismatch");
    expect(num.groups.map((g) => g.sources.map((s) => s.label))).toEqual(
      expect.arrayContaining([["SB 1234567"], expect.arrayContaining(["F13 BOM123", "SEAL ABCD12345678"])]),
    );
    expect(num.owners).toEqual(expect.arrayContaining(["cha", "transporter", "consignor"]));
    const digit = find(r, "derived.checkDigit")[0];
    expect(digit.status).toBe("invalid");
    expect(digit.message).toContain("CSQU 305438 3");
    expect(r.bySubmission.sb1).toBe(2);
  });

  it("joins a typo even without a shared seal, but keeps two valid neighbouring numbers apart", () => {
    const src = (id: string): SourceRef => ({ submissionId: id, docType: "packing_list", label: id, role: "consignor", adderName: "A" });
    const m = (id: string, n: string): ContainerMention => ({ number: n, eSeal: null, source: src(id), claims: [] });
    expect(linkContainers([m("a", GOOD), m("b", TYPO)])).toHaveLength(1);
    expect(linkContainers([m("a", "CSQU3054383"), m("b", "MSKU9998019")])).toHaveLength(2);
  });

  it("flags a vehicle swap that wasn't updated on the e-way bill, and an expired e-way bill", () => {
    const r = runChecks({ caseRecord, caseOwner: owner, submissions: [sb(GOOD), ewb("MH04AB1234", "2026-11-05"), lr("MH04XY9999")], today: "2026-11-09" });
    const v = find(r, "vehicle.number")[0];
    expect(v.status).toBe("mismatch");
    expect(v.owners.sort()).toEqual(["consignor", "transporter"]);
    expect(find(r, "derived.ewbValidity")[0].status).toBe("mismatch");
  });

  it("warns about Part B missing", () => {
    const r = runChecks({ caseRecord, caseOwner: owner, submissions: [ewb(null, null)], today: "2026-11-09" });
    expect(find(r, "derived.ewbPartB")[0].status).toBe("warning");
  });

  it("catches a VGM that doesn't fit the shipping bill's weight, and softens it when the tare is estimated", () => {
    const hard = runChecks({ caseRecord, caseOwner: owner, submissions: [sb(GOOD), vgm(19000, 2200)], today: "2026-11-09" });
    expect(find(hard, "derived.vgmVsGross")[0].status).toBe("mismatch");
    const soft = runChecks({ caseRecord, caseOwner: owner, submissions: [sb(GOOD), vgm(19000, null)], today: "2026-11-09" });
    expect(find(soft, "derived.vgmVsGross")[0].status).toBe("warning");
    expect(find(soft, "container.vgm")[0].status).toBe("single");
  });

  it("treats a lone LR charged weight difference as a warning", () => {
    const r = runChecks({ caseRecord, caseOwner: owner, submissions: [sb(GOOD), lr("MH04AB1234", 13)], today: "2026-11-09" });
    expect(find(r, "goods.grossWeight")[0].status).toBe("warning");
  });

  it("keeps an acknowledgement only while the values stay the same", () => {
    const subs = [sb(GOOD), ewb("MH04AB1234", "2026-11-12"), lr("MH04XY9999")];
    const first = runChecks({ caseRecord, caseOwner: owner, submissions: subs, today: "2026-11-09" });
    const v = find(first, "vehicle.number")[0];
    const ack = { checkKey: v.key, valuesKey: v.valuesKey, note: "Truck swapped at Bhiwandi", byName: "Kiran", at: new Date() };
    const acked = runChecks({ caseRecord, caseOwner: owner, submissions: subs, acks: [ack], today: "2026-11-09" });
    expect(find(acked, "vehicle.number")[0].acknowledged?.note).toBe("Truck swapped at Bhiwandi");
    expect(acked.counts.mismatch).toBe(first.counts.mismatch - 1);
    const changed = runChecks({ caseRecord, caseOwner: owner, submissions: [sb(GOOD), ewb("MH04AB1234", "2026-11-12"), lr("MH04ZZ0001")], acks: [ack], today: "2026-11-09" });
    expect(find(changed, "vehicle.number")[0].acknowledged).toBeUndefined();
  });

  it("warns when consignee names are written differently", () => {
    const inv: CheckSubmission = {
      id: "inv",
      type: "commercial_invoice",
      addedByRole: "consignor",
      adderName: "Asha",
      documentNumber: "INV-26-001",
      normalized: {
        documentNumber: "INV-26-001",
        documentDate: "2026-10-30",
        exporterGstin: "27ABCDE1234F1Z5",
        buyerName: "GULF TRADERS GENERAL TRADING LLC",
        destinationCountry: "AE",
        currency: "USD",
        irn: null,
        totals: { value: 15000 },
        lines: [{ lineNo: 1, description: "Granules", hsCode: "39011010", quantity: 12000, uqc: "KGS", value: 15000 }],
      },
    };
    const r = runChecks({ caseRecord, caseOwner: owner, submissions: [sb(GOOD), ewb("MH04AB1234", "2026-11-12"), inv], today: "2026-11-09" });
    expect(find(r, "consignee.name")[0].status).toBe("warning");
    expect(find(r, "invoice.number")[0].status).toBe("warning"); // INV/26/001 vs INV-26-001
  });
});
