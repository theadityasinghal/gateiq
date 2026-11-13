import { describe, expect, it } from "vitest";
import { runChecks, type CheckSubmission } from "@/lib/checks/engine";
import { FACT_AUTHORITY, FACT_KEYS, canConfirm, canDeclare, effectiveLevel, type FactView } from "@/lib/facts/ladder";

const GOOD = "CSQU3054383";
const caseRecord = { exportPortCode: "INNSA1", consigneeName: "Gulf Traders LLC", lines: [{ hsCode: "39011010", packages: 40, grossWeight: 12500, weightUnit: "KGS" }] };
const owner = { role: "consignor" as const, name: "Asha" };

const sb = (number: string): CheckSubmission => ({
  id: `sb-${number}`,
  type: "shipping_bill",
  addedByRole: "cha",
  adderName: "Ravi",
  documentNumber: number,
  normalized: {
    documentNumber: number,
    documentDate: "2026-11-01",
    portCode: "INNSA1",
    exporter: { iec: "ABCDE1234F", gstin: "27ABCDE1234F1Z5" },
    consigneeName: "GULF TRADERS LLC",
    currency: "USD",
    totals: { packages: 40, grossWeightT: 12.5, netWeightT: 12, value: 15000 },
    lines: [{ lineNo: 1, description: "Granules", hsCode: "39011010", quantity: 12000, uqc: "KGS", value: 15000 }],
    containers: [{ number: GOOD, sizeType: "22G1", sealNo: "ABCD12345678" }],
  },
});

const eseal = (sbNumber: string): CheckSubmission => ({
  id: `seal-${sbNumber}`,
  type: "e_seal",
  addedByRole: "consignor",
  adderName: "Asha",
  documentNumber: "ABCD12345678",
  normalized: { documentNumber: "ABCD12345678", documentDate: "2026-11-02", eSealNo: "ABCD12345678", containerNumber: GOOD, sbNumber, sbDate: "2026-11-01", iec: "ABCDE1234F", truckNumber: "MH04AB1234" },
});

const fact = (over: Partial<FactView> & Pick<FactView, "factKey" | "value" | "display">): FactView => ({
  id: "f1",
  scope: "case",
  level: "declared",
  setBy: { userId: "u-asha", name: "Asha", role: "consignor" },
  setAt: new Date("2026-11-03"),
  evidence: [],
  confirmations: [],
  ...over,
});

const run = (submissions: CheckSubmission[], facts: FactView[]) => runChecks({ caseRecord, caseOwner: owner, submissions, facts, today: "2026-11-05" });
const sbNumber = (r: ReturnType<typeof run>) => r.caseChecks.find((c) => c.fact === "sb.number")!;

describe("effective level", () => {
  const base = { level: "declared" as const, setBy: { userId: "a", role: "consignor" as const } };
  it("stays declared until a different account in a different role confirms", () => {
    expect(effectiveLevel({ ...base, confirmations: [] })).toBe("declared");
    expect(effectiveLevel({ ...base, confirmations: [{ userId: "a", role: "cha" }] })).toBe("declared");
    expect(effectiveLevel({ ...base, confirmations: [{ userId: "b", role: "consignor" }] })).toBe("declared");
    expect(effectiveLevel({ ...base, confirmations: [{ userId: "b", role: "cha" }] })).toBe("confirmed");
  });
  it("keeps a stored higher level", () => {
    expect(effectiveLevel({ ...base, level: "observed", confirmations: [] })).toBe("observed");
  });
});

describe("who may declare and confirm", () => {
  it("gives every verifiable fact an authority, and never a read-only role", () => {
    for (const key of FACT_KEYS) {
      expect(FACT_AUTHORITY[key].length).toBeGreaterThan(0);
      expect(canDeclare("gate_officer", key)).toBe(false);
    }
    expect(canDeclare("consignor", "sb.number")).toBe(true);
    expect(canDeclare("driver", "sb.number")).toBe(false);
    expect(canDeclare("transporter", "vehicle.number")).toBe(true);
    expect(canDeclare("consignor", "vehicle.number")).toBe(false);
  });

  const f = fact({ factKey: "sb.number", value: "1234567", display: "1234567" });
  it("will not let anyone confirm their own value or one in their own role", () => {
    expect(canConfirm({ id: "u-asha", role: "consignor" }, f).ok).toBe(false);
    expect(canConfirm({ id: "u-other", role: "consignor" }, f).ok).toBe(false);
  });
  it("lets a different role confirm once, and not a read-only viewer", () => {
    expect(canConfirm({ id: "u-ravi", role: "cha" }, f).ok).toBe(true);
    const again = { ...f, confirmations: [{ userId: "u-ravi", role: "cha" as const, name: "Ravi", at: new Date() }] };
    expect(canConfirm({ id: "u-ravi", role: "cha" }, again).ok).toBe(false);
    expect(canConfirm({ id: "u-go", role: "gate_officer" }, f).ok).toBe(false);
  });
});

describe("checks against a verified value", () => {
  it("compares documents with each other when there is no verified value", () => {
    const r = sbNumber(run([sb("1234567"), eseal("7654321")], []));
    expect(r.status).toBe("mismatch");
    expect(r.verified).toBeUndefined();
  });

  it("agrees when every document matches the verified value, even a single one", () => {
    const r = sbNumber(run([sb("1234567")], [fact({ factKey: "sb.number", value: "1234567", display: "1234567" })]));
    expect(r.status).toBe("agree");
    expect(r.verified?.display).toBe("1234567");
    expect(r.groups.every((g) => g.matchesVerified)).toBe(true);
  });

  it("flags only the documents that differ from the verified value, and names their owners", () => {
    const r = sbNumber(run([sb("1234567"), eseal("7654321")], [fact({ factKey: "sb.number", value: "1234567", display: "1234567" })]));
    expect(r.status).toBe("mismatch");
    expect(r.message).toContain("1234567");
    expect(r.owners).toEqual(["consignor"]);
    expect(r.groups.find((g) => g.display === "7654321")?.matchesVerified).toBe(false);
  });

  it("makes an explanation lapse when the verified value changes", () => {
    const docs = [sb("1234567"), eseal("7654321")];
    const a = sbNumber(run(docs, [fact({ factKey: "sb.number", value: "1234567", display: "1234567" })]));
    const b = sbNumber(run(docs, [fact({ factKey: "sb.number", value: "7654321", display: "7654321" })]));
    expect(a.valuesKey).not.toBe(b.valuesKey);
  });

  it("applies a container fact only to its own container", () => {
    const f = fact({ factKey: "container.eSeal", scope: GOOD, value: "ZZZZ00000000", display: "ZZZZ00000000" });
    const report = run([sb("1234567"), eseal("1234567")], [f]);
    const seal = report.containers[0].results.find((r) => r.fact === "container.eSeal")!;
    expect(seal.status).toBe("mismatch");
    expect(seal.verified?.display).toBe("ZZZZ00000000");
    const other = run([sb("1234567"), eseal("1234567")], [{ ...f, scope: "MSKU0000000" }]);
    expect(other.containers[0].results.find((r) => r.fact === "container.eSeal")!.verified).toBeUndefined();
  });
});
