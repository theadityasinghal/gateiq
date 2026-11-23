import { describe, expect, it } from "vitest";
import { runChecks, type CheckSubmission } from "@/lib/checks/engine";
import { canAcknowledge } from "@/lib/checks/ack";
import { caseFlow } from "@/lib/case-flow";
import { FACT_LEVEL_LABEL, type FactView } from "@/lib/facts/ladder";

const caseRecord = { exportPortCode: "INNSA1", consigneeName: null, lines: [{ hsCode: "39011010", packages: 40, grossWeight: 12500, weightUnit: "KGS" }] };
const owner = { id: "u-asha", role: "consignor" as const, name: "Asha" };

const sb = (number: string, by = { id: "u-ravi", role: "cha" as const, name: "Ravi" }): CheckSubmission => ({
  id: `sb-${number}-${by.id}`,
  type: "shipping_bill",
  addedByRole: by.role,
  addedBy: by.id,
  adderName: by.name,
  documentNumber: number,
  normalized: {
    documentNumber: number,
    documentDate: "2026-11-01",
    portCode: "INNSA1",
    exporter: { iec: "ABCDE1234F", gstin: "27ABCDE1234F1Z5" },
    consigneeName: null,
    currency: "USD",
    totals: { packages: 40, grossWeightT: 12.5, netWeightT: 12, value: 15000 },
    lines: [{ lineNo: 1, description: "Granules", hsCode: "39011010", quantity: 12000, uqc: "KGS", value: 15000 }],
    containers: [],
  },
});

const eseal = (sbNumber: string): CheckSubmission => ({
  id: `seal-${sbNumber}`,
  type: "e_seal",
  addedByRole: "consignor",
  addedBy: "u-asha",
  adderName: "Asha",
  documentNumber: "ABCD12345678",
  normalized: { documentNumber: "ABCD12345678", documentDate: "2026-11-02", eSealNo: "ABCD12345678", containerNumber: "CSQU3054383", sbNumber, sbDate: "2026-11-01", iec: "ABCDE1234F", truckNumber: "MH04AB1234" },
});

const fact = (over: Partial<FactView>): FactView => ({
  id: "f1",
  factKey: "sb.number",
  scope: "case",
  value: "1234567",
  display: "1234567",
  level: "declared",
  setBy: { userId: "u-ravi", name: "Ravi", role: "cha" },
  setAt: new Date("2026-11-03"),
  evidence: [],
  confirmations: [],
  ...over,
});

const run = (submissions: CheckSubmission[], facts: FactView[] = []) => runChecks({ caseRecord, caseOwner: owner, submissions, facts, today: "2026-11-05" });
const sbNumber = (r: ReturnType<typeof run>) => r.caseChecks.find((c) => c.fact === "sb.number")!;

describe("honest labels", () => {
  it("never calls agreement verification", () => {
    expect(FACT_LEVEL_LABEL.confirmed).toBe("Agreed");
    expect(FACT_LEVEL_LABEL.declared).toBe("Stated");
  });
});

describe("one paper only", () => {
  it("does not count a value as backed up by the very paper it was taken from", () => {
    const doc = sb("1234567");
    const r = sbNumber(run([doc], [fact({ evidence: [doc.id] })]));
    expect(r.status).toBe("single");
    expect(run([doc], [fact({ evidence: [doc.id] })]).counts.single).toBeGreaterThan(0);
  });

  it("counts two agreeing papers as agreement even when both were the value's evidence", () => {
    const doc = sb("1234567");
    const seal = eseal("1234567");
    const r = sbNumber(run([doc, seal], [fact({ evidence: [doc.id, seal.id] })]));
    expect(r.status).toBe("agree");
  });

  it("counts a second, independent paper as agreement", () => {
    const doc = sb("1234567");
    const r = sbNumber(run([doc, eseal("1234567")], [fact({ evidence: [doc.id] })]));
    expect(r.status).toBe("agree");
  });

  it("counts the value as agreed once someone else has agreed, even with one paper", () => {
    const doc = sb("1234567");
    const r = sbNumber(run([doc], [fact({ evidence: [doc.id], level: "confirmed" })]));
    expect(r.status).toBe("agree");
  });

  it("says so in the flow when nothing disagrees", () => {
    const flow = caseFlow({ role: "consignor", members: 1, consigneeLinked: true, docTypes: ["shipping_bill"], needs: [], issues: { toFix: 0, worthALook: 0, forYou: 0, onePaper: 3 } });
    expect(flow.steps.find((s) => s.key === "checks")?.detail).toBe("3 values on one paper only");
  });
});

describe("who is implicated in a problem", () => {
  it("names the accounts behind a document-vs-document mismatch", () => {
    const r = sbNumber(run([sb("1234567"), eseal("7654321")]));
    expect(r.status).toBe("mismatch");
    expect(r.implicated.sort()).toEqual(["u-asha", "u-ravi"]);
  });

  it("names only the accounts whose papers differ from the case's value", () => {
    const r = sbNumber(run([sb("1234567"), eseal("7654321")], [fact({})]));
    expect(r.implicated).toEqual(["u-asha"]);
  });

  it("names nobody when everything agrees", () => {
    expect(sbNumber(run([sb("1234567"), eseal("1234567")])).implicated).toEqual([]);
  });
});

describe("explaining a problem", () => {
  const problem = { status: "mismatch" as const, implicated: ["u-asha"], acknowledged: null };

  it("lets the person behind the paper explain, flagged as their own", () => {
    expect(canAcknowledge({ id: "u-asha", role: "consignor" }, problem)).toEqual({ ok: true, self: true });
  });

  it("lets someone else explain without the flag", () => {
    expect(canAcknowledge({ id: "u-ravi", role: "cha" }, problem)).toEqual({ ok: true, self: false });
  });

  it("never lets a driver or a view-only account explain", () => {
    expect(canAcknowledge({ id: "u-d", role: "driver" }, problem).ok).toBe(false);
    expect(canAcknowledge({ id: "u-g", role: "gate_officer" }, problem).ok).toBe(false);
  });

  it("refuses when there is nothing to explain, or it is already explained", () => {
    expect(canAcknowledge({ id: "u-ravi", role: "cha" }, { ...problem, status: "agree" }).ok).toBe(false);
    expect(canAcknowledge({ id: "u-ravi", role: "cha" }, { ...problem, acknowledged: { note: "x", byName: "A", at: new Date(), self: false } }).ok).toBe(false);
  });
});

describe("signed e-invoice values", () => {
  const invoice = (number: string, signedFacts: CheckSubmission["signedFacts"]): CheckSubmission => ({
    id: `inv-${number}`,
    type: "commercial_invoice",
    addedByRole: "consignor",
    addedBy: "u-asha",
    adderName: "Asha",
    signedFacts,
    documentNumber: number,
    normalized: {
      documentNumber: number,
      documentDate: "2026-10-30",
      exporterGstin: "27ABCDE1234F1Z5",
      buyerName: null,
      destinationCountry: "AE",
      currency: "USD",
      irn: null,
      totals: { value: 15000 },
      lines: [],
    },
  });
  const invFact = fact({ factKey: "invoice.number", value: "INV/26/001", display: "INV/26/001", setBy: { userId: "u-asha", name: "Asha", role: "consignor" } });
  const invNumber = (r: ReturnType<typeof run>) => r.caseChecks.find((c) => c.fact === "invoice.number")!;

  it("raises the case's value to signed when a signed document carries it, even on its own", () => {
    const doc = invoice("INV/26/001", ["invoice.number"]);
    const r = invNumber(run([doc], [{ ...invFact, evidence: [doc.id] }]));
    expect(r.status).toBe("agree");
    expect(r.verified?.level).toBe("source_verified");
    expect(r.groups[0].signed).toBe(true);
  });

  it("does not raise it when the signed field was edited", () => {
    const doc = invoice("INV/26/001", []);
    const r = invNumber(run([doc], [{ ...invFact, evidence: [doc.id] }]));
    expect(r.verified?.level).toBe("declared");
    expect(r.status).toBe("single");
  });
});

describe("which saved fields a signed QR vouches for", () => {
  it("counts fields saved as signed, and records edited ones", async () => {
    const { signedFields, signedFactsOf } = await import("@/lib/qr/signed");
    const rec = signedFields({ invoiceNumber: "INV/26/001", invoiceDate: "2026-10-30", exporterGstin: "27ABCDE1234F1Z5", irn: "x" }, { invoiceNumber: "inv/26/001", invoiceDate: "2026-10-31", exporterGstin: "27ABCDE1234F1Z5" });
    expect(rec.facts.sort()).toEqual(["exporter.gstin", "invoice.number"]);
    expect(rec.edited).toEqual(["invoiceDate"]);
    expect(signedFactsOf({ signed: rec })).toEqual(rec.facts);
    expect(signedFactsOf({ signed: { facts: ["goods.packages"] } })).toEqual([]);
  });
});
