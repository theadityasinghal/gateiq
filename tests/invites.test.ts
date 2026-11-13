import { describe, expect, it } from "vitest";
import { ROLES, ROLE_INFO, canInvite, invitableRoles, lostOnRoleChange } from "@/lib/roles";

describe("who can invite whom", () => {
  it("chains down the line", () => {
    expect(invitableRoles("consignor")).toEqual(["consignee", "cha", "transporter"]);
    expect(invitableRoles("consignee")).toEqual(["cha", "transporter"]);
    expect(invitableRoles("cha")).toEqual(["transporter"]);
    expect(invitableRoles("transporter")).toEqual(["driver"]);
    expect(invitableRoles("driver")).toEqual([]);
  });

  it("never lets anyone invite an official", () => {
    for (const from of ROLES) for (const to of ROLES) if (ROLE_INFO[to].official) expect(canInvite(from, to)).toBe(false);
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

  it("warns that a role change ends shared access", () => {
    expect(lostOnRoleChange("cha", "transporter")).toContain("Access to cases shared with you, and every invite you sent");
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
  it("leaves out every official role until the gate phase exists", async () => {
    const { SELECTABLE_ROLES, isSelectableRole } = await import("@/lib/roles");
    for (const role of ROLES) expect(isSelectableRole(role)).toBe(!ROLE_INFO[role].official);
    expect(SELECTABLE_ROLES).toEqual(["consignor", "consignee", "cha", "transporter", "driver"]);
    expect(isSelectableRole("not_a_role")).toBe(false);
  });
});
