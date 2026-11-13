import { describe, expect, it } from "vitest";
import { ROLES, ROLE_INFO, canInvite, invitableRoles, isReadOnly } from "@/lib/roles";

describe("who can invite whom", () => {
  it("chains down the line", () => {
    expect(invitableRoles("consignor")).toEqual(["consignee", "cha", "transporter", "gate_officer"]);
    expect(invitableRoles("consignee")).toEqual(["cha", "transporter", "gate_officer"]);
    expect(invitableRoles("cha")).toEqual(["transporter", "gate_officer"]);
    expect(invitableRoles("transporter")).toEqual(["driver", "gate_officer"]);
    expect(invitableRoles("driver")).toEqual(["gate_officer"]);
  });

  it("lets every account that can add to a case bring in a gate officer, and nobody invite another official", () => {
    for (const from of ROLES) {
      for (const to of ROLES) {
        if (!ROLE_INFO[to].official) continue;
        const allowed = to === "gate_officer" && !ROLE_INFO[from].official;
        expect(canInvite(from, to), `${from} -> ${to}`).toBe(allowed);
      }
    }
  });

  it("never lets an official invite", () => {
    for (const from of ROLES) if (ROLE_INFO[from].official) expect(invitableRoles(from)).toEqual([]);
  });

  it("refuses inviting your own kind or going back up the chain", () => {
    expect(canInvite("consignor", "consignor")).toBe(false);
    expect(canInvite("cha", "consignor")).toBe(false);
    expect(canInvite("transporter", "cha")).toBe(false);
    expect(canInvite("consignor", "driver")).toBe(false);
  });

  it("treats only the gate officer as read-only", () => {
    for (const role of ROLES) expect(isReadOnly(role)).toBe(role === "gate_officer");
  });
});

describe("consignee", () => {
  it("is invited only by the consignor", () => {
    expect(canInvite("consignor", "consignee")).toBe(true);
    for (const from of ROLES) if (from !== "consignor") expect(canInvite(from, "consignee")).toBe(false);
  });

  it("can bring in a CHA and transporter for buyer-arranged freight, but not a driver or the consignor", () => {
    expect(canInvite("consignee", "cha")).toBe(true);
    expect(canInvite("consignee", "transporter")).toBe(true);
    expect(canInvite("consignee", "driver")).toBe(false);
    expect(canInvite("consignee", "consignor")).toBe(false);
  });
});

describe("account types offered at sign-up", () => {
  it("offers the gate officer but leaves out the other official roles", async () => {
    const { SELECTABLE_ROLES, isSelectableRole } = await import("@/lib/roles");
    for (const role of ROLES) expect(isSelectableRole(role)).toBe(ROLE_INFO[role].available);
    expect(SELECTABLE_ROLES).toEqual(["consignor", "consignee", "cha", "transporter", "driver", "gate_officer"]);
    expect(isSelectableRole("not_a_role")).toBe(false);
  });
});
