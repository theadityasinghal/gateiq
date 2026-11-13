import { describe, expect, it } from "vitest";
import { describeEvent } from "@/lib/audit-events";

describe("activity sentences", () => {
  it("names the document and its number", () => {
    expect(describeEvent("case.submission_added", { type: "shipping_bill", documentNumber: "1234567" }).text).toBe("added a shipping bill 1234567");
    expect(describeEvent("case.submission_added", { type: "e_seal" }).text).toBe("added an e-seal record");
    expect(describeEvent("case.submission_removed", { type: "packing_list" })).toMatchObject({ icon: "trash", group: "documents" });
  });
  it("describes facts with their label and value", () => {
    expect(describeEvent("fact.confirmed", { factKey: "sb.number", display: "1234567" }).text).toBe("confirmed shipping bill number 1234567");
    expect(describeEvent("fact.replaced", { factKey: "sb.number", display: "7654321", from: "1234567" }).text).toBe("changed shipping bill number from 1234567 to 7654321");
    expect(describeEvent("fact.confirmed", { factKey: "exporter.iec", display: "ABCDE1234F" }).text).toBe("confirmed exporter IEC ABCDE1234F");
    expect(describeEvent("fact.declared", { seeded: ["port.code", "goods.hsCodes"] }).text).toBe("declared 2 values from the case record");
    expect(describeEvent("fact.declared", { factKey: "container.eSeal", scope: "CSQU3054383", display: "AB1" }).text).toContain("for CSQU3054383");
  });
  it("describes people changes, and survives odd details", () => {
    expect(describeEvent("case.member_invited", { invitee: "ravi.cha" }).text).toBe("invited @ravi.cha");
    expect(describeEvent("case.member_removed", { removed: [{ username: "a" }, { username: "b" }] }).text).toBe("removed @a, @b");
    expect(describeEvent("case.member_removed", { removed: "nope" }).text).toBe("removed a member");
    expect(describeEvent("case.unknown_thing", {}).text).toBe("case unknown thing");
  });
});
