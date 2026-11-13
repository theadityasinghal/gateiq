/**
 * The 11 GateIQ account types. Any user may pick any role (product decision);
 * official roles carry a "government email domain" signal only (see verify/).
 */
export const ROLES = [
  "consignor",
  "consignee",
  "cha",
  "transporter",
  "driver",
  "gate_officer",
  "weighbridge_operator",
  "customs_inspector",
  "customs_superintendent",
  "terminal_admin",
  "vigilance_auditor",
] as const;

export type Role = (typeof ROLES)[number];

export type Tint = "peach" | "rose" | "mint" | "lavender" | "sky" | "yellow" | "cream" | "gray";

export type IdField = {
  key: "chaLicence" | "transporterGstin" | "drivingLicence" | "employeeId";
  label: string;
  placeholder: string;
};

export const ROLE_INFO: Record<
  Role,
  { label: string; blurb: string; tint: Tint; official: boolean; idField?: IdField }
> = {
  consignor: {
    label: "Consignor / Exporter",
    blurb: "Create shipment cases and record what you filed on ICEGATE.",
    tint: "lavender",
    official: false,
  },
  consignee: {
    label: "Consignee / Buyer",
    blurb: "Receive the goods. The exporter invites you to each case.",
    tint: "mint",
    official: false,
  },
  cha: {
    label: "Customs House Agent (CHA)",
    blurb: "File declarations on behalf of exporters.",
    tint: "sky",
    official: false,
    idField: { key: "chaLicence", label: "Customs broker licence no.", placeholder: "As on your CBIC licence" },
  },
  transporter: {
    label: "Transporter / Fleet Dispatcher",
    blurb: "Assign vehicles and drivers to consignments.",
    tint: "peach",
    official: false,
    idField: { key: "transporterGstin", label: "Transporter GSTIN", placeholder: "15-character GSTIN" },
  },
  driver: {
    label: "Truck Driver",
    blurb: "Carry the consignment to the gate.",
    tint: "yellow",
    official: false,
    idField: { key: "drivingLicence", label: "Driving licence no.", placeholder: "e.g. state code + RTO + year + serial" },
  },
  gate_officer: {
    label: "Gate Entry Officer",
    blurb: "Check arriving vehicles against the filed record.",
    tint: "mint",
    official: true,
    idField: { key: "employeeId", label: "Employee / service ID", placeholder: "As issued by your department" },
  },
  weighbridge_operator: {
    label: "Weighbridge Operator",
    blurb: "Record measured weights at the terminal.",
    tint: "cream",
    official: true,
    idField: { key: "employeeId", label: "Employee ID", placeholder: "As issued by the terminal" },
  },
  customs_inspector: {
    label: "Customs Inspector (PO)",
    blurb: "Examine consignments selected for inspection.",
    tint: "rose",
    official: true,
    idField: { key: "employeeId", label: "Employee / service ID", placeholder: "As issued by CBIC" },
  },
  customs_superintendent: {
    label: "Customs Superintendent / Appraiser",
    blurb: "Review discrepancies and decide outcomes.",
    tint: "lavender",
    official: true,
    idField: { key: "employeeId", label: "Employee / service ID", placeholder: "As issued by CBIC" },
  },
  terminal_admin: {
    label: "Terminal Administrator",
    blurb: "Manage terminal staff and settings.",
    tint: "sky",
    official: true,
    idField: { key: "employeeId", label: "Employee ID", placeholder: "As issued by the terminal" },
  },
  vigilance_auditor: {
    label: "Central Vigilance / Auditor",
    blurb: "Audit decisions and the record trail.",
    tint: "gray",
    official: true,
    idField: { key: "employeeId", label: "Employee / service ID", placeholder: "As issued by your department" },
  },
};

/**
 * Account types a person can choose today. The official roles have no screens yet (they can't be invited
 * and can't open a case), and nothing verifies who claims one, so they stay out of sign-up until the gate
 * phase exists and an admin can provision them. Existing accounts keep theirs.
 */
export const SELECTABLE_ROLES: readonly Role[] = ROLES.filter((r) => !ROLE_INFO[r].official);

export function isSelectableRole(value: unknown): value is Role {
  return typeof value === "string" && (SELECTABLE_ROLES as readonly string[]).includes(value);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Who can invite whom to a case, down the chain of custody. Officials appear in no list, so they are
 * never invited; they will reach cases through their own screens.
 * The consignee can bring in a CHA and a transporter for buyer-arranged freight (EXW, FCA, FOB).
 */
export const INVITES: Partial<Record<Role, readonly Role[]>> = {
  consignor: ["consignee", "cha", "transporter"],
  consignee: ["cha", "transporter"],
  cha: ["transporter"],
  transporter: ["driver"],
};

export function canInvite(from: Role, to: Role): boolean {
  return INVITES[from]?.includes(to) ?? false;
}

/** A case has at most one consignee. */
export const ONE_PER_CASE: readonly Role[] = ["consignee"];

export function invitableRoles(from: Role): readonly Role[] {
  return INVITES[from] ?? [];
}

/** Profile columns that only make sense for one kind of account. Name and mobile number are shared by all. */
export type RoleField = "organisation" | "iec" | "gstin" | "address";

export function roleFields(role: Role): RoleField[] {
  if (role === "consignor") return ["iec", "gstin", "address"];
  if (role === "consignee") return ["organisation", "address"];
  return ["organisation"];
}

/**
 * What a user loses when switching from one account type to another, in plain words.
 * The role-specific ID (licence, employee ID, …) is always dropped, even when both roles ask for an "employee ID",
 * because it was issued for the old role.
 */
export function lostOnRoleChange(from: Role, to: Role): string[] {
  if (from === to) return [];
  const labels: Record<RoleField, string> = {
    organisation: "Organisation",
    iec: "IEC",
    gstin: "GSTIN",
    address: "Registered address",
  };
  const keep = new Set(roleFields(to));
  const lost = roleFields(from).filter((f) => !keep.has(f)).map((f) => labels[f]);
  const id = ROLE_INFO[from].idField;
  if (id) lost.push(id.label.charAt(0).toUpperCase() + id.label.slice(1));
  if (from === "consignor") lost.push("All your shipment cases, with their filings and uploaded documents");
  lost.push("Access to cases shared with you, and every invite you sent");
  return lost;
}
