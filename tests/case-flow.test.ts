import { describe, expect, it } from "vitest";
import { caseFlow } from "@/lib/case-flow";
import { expectedDocuments, missingDocuments, type DocType } from "@/lib/documents";

const plain = expectedDocuments({});
const ALL_PLAIN: DocType[] = ["shipping_bill", "commercial_invoice", "packing_list", "eway_bill", "lorry_receipt"];
const clean = { toFix: 0, worthALook: 0, forYou: 0 };

describe("expected documents", () => {
  it("asks for the shipping papers, and certificates only for the cargo flags that need them", () => {
    expect(plain.map((n) => n.key)).toEqual(["shipping_bill", "commercial_invoice", "packing_list", "eway_bill", "lorry_receipt"]);
    const special = expectedDocuments({ hazmat: { unNumber: "UN1203" }, pharma: { minC: 2, maxC: 8 }, perishable: { certificateType: "phytosanitary" } });
    expect(special.map((n) => n.key)).toEqual([...plain.map((n) => n.key), "msds", "temperature_spec", "perishable_certificate"]);
  });

  it("accepts either certificate for perishables", () => {
    const needs = expectedDocuments({ perishable: {} });
    expect(missingDocuments(needs, ALL_PLAIN).map((n) => n.key)).toEqual(["perishable_certificate"]);
    expect(missingDocuments(needs, [...ALL_PLAIN, "quality_certificate"])).toEqual([]);
    expect(missingDocuments(needs, [...ALL_PLAIN, "fumigation_certificate"])).toEqual([]);
  });
});

describe("case flow", () => {
  const base = { members: 0, consigneeLinked: false, docTypes: [] as DocType[], needs: plain, issues: null };

  it("starts with the consignor inviting people", () => {
    const f = caseFlow({ ...base, role: "consignor" });
    expect(f.steps.map((s) => s.state)).toEqual(["done", "current", "todo", "todo", "later"]);
    expect(f.next).toBe("Invite your consignee to this case.");
  });

  it("tells each account type to add only what it may add", () => {
    const withBill = caseFlow({ ...base, role: "transporter", members: 1, docTypes: ["shipping_bill"] });
    expect(withBill.next).toBe("Add e-way bill and lorry receipt.");
    const cha = caseFlow({ ...base, role: "cha", members: 1, consigneeLinked: true, docTypes: ["eway_bill", "lorry_receipt"] });
    expect(cha.next).toBe("Add shipping bill, commercial invoice and 1 more.");
  });

  it("waits for papers before calling the checks clean", () => {
    const f = caseFlow({ ...base, role: "consignor", members: 1, consigneeLinked: true, docTypes: ["shipping_bill"], issues: clean });
    expect(f.steps.find((s) => s.key === "checks")?.state).not.toBe("done");
    expect(f.steps.find((s) => s.key === "documents")).toMatchObject({ state: "current", detail: "1 of 5" });
  });

  it("is complete with every paper and no open checks, and the gate stays not live", () => {
    const f = caseFlow({ ...base, role: "consignor", members: 2, consigneeLinked: true, docTypes: ALL_PLAIN, issues: clean });
    expect(f.steps.map((s) => s.state)).toEqual(["done", "done", "done", "done", "later"]);
    expect(f.next).toBe("Nothing needed from you right now.");
  });

  it("points at the checks the viewer can fix", () => {
    const f = caseFlow({ ...base, role: "consignor", members: 1, consigneeLinked: true, docTypes: ALL_PLAIN, issues: { toFix: 2, worthALook: 1, forYou: 2 } });
    expect(f.next).toBe("Fix or explain 2 checks on your documents.");
    expect(f.steps.find((s) => s.key === "checks")).toMatchObject({ state: "current", detail: "3 open checks" });
  });

  it("tells a read-only viewer there is nothing to add, and counts the flags", () => {
    expect(caseFlow({ ...base, role: "gate_officer", issues: { toFix: 1, worthALook: 1, forYou: 0 } }).next).toBe("Nothing to add. 2 open flags to review.");
    expect(caseFlow({ ...base, role: "gate_officer", issues: clean }).next).toBe("Nothing to add. No open flags.");
  });
});
