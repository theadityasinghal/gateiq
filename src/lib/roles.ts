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
  { label: string; blurb: string; tint: Tint; official: boolean; available: boolean; idField?: IdField }
> = {
  consignor: {
    label: "Consignor / Exporter",
    blurb: "Create shipment cases and record what you filed on ICEGATE.",
    tint: "lavender",
    official: false,
    available: true,
  },
  consignee: {
    label: "Consignee / Buyer",
    blurb: "Receive the goods. The exporter invites you to each case.",
    tint: "mint",
    official: false,
    available: true,
  },
  cha: {
    label: "Customs House Agent (CHA)",
    blurb: "File declarations on behalf of exporters.",
    tint: "sky",
    official: false,
    available: true,
    idField: { key: "chaLicence", label: "Customs broker licence no.", placeholder: "As on your CBIC licence" },
  },
  transporter: {
    label: "Transporter / Fleet Dispatcher",
    blurb: "Assign vehicles and drivers to consignments.",
    tint: "peach",
    official: false,
    available: true,
    idField: { key: "transporterGstin", label: "Transporter GSTIN", placeholder: "15-character GSTIN" },
  },
  driver: {
    label: "Truck Driver",
    blurb: "Carry the consignment to the gate.",
    tint: "yellow",
    official: false,
    available: true,
    idField: { key: "drivingLicence", label: "Driving licence no.", placeholder: "e.g. state code + RTO + year + serial" },
  },
  gate_officer: {
    label: "Gate Entry Officer",
    blurb: "View every case you are added to: documents, files, verified info, flags and activity. You cannot change anything.",
    tint: "mint",
    official: true,
    available: true,
    idField: { key: "employeeId", label: "Employee / service ID", placeholder: "As issued by your department" },
  },
  weighbridge_operator: {
    label: "Weighbridge Operator",
    blurb: "Record measured weights at the terminal.",
    tint: "cream",
    official: true,
    available: false,
    idField: { key: "employeeId", label: "Employee ID", placeholder: "As issued by the terminal" },
  },
  customs_inspector: {
    label: "Customs Inspector (PO)",
    blurb: "Examine consignments selected for inspection.",
    tint: "rose",
    official: true,
    available: false,
    idField: { key: "employeeId", label: "Employee / service ID", placeholder: "As issued by CBIC" },
  },
  customs_superintendent: {
    label: "Customs Superintendent / Appraiser",
    blurb: "Review discrepancies and decide outcomes.",
    tint: "lavender",
    official: true,
    available: false,
    idField: { key: "employeeId", label: "Employee / service ID", placeholder: "As issued by CBIC" },
  },
  terminal_admin: {
    label: "Terminal Administrator",
    blurb: "Manage terminal staff and settings.",
    tint: "sky",
    official: true,
    available: false,
    idField: { key: "employeeId", label: "Employee ID", placeholder: "As issued by the terminal" },
  },
  vigilance_auditor: {
    label: "Central Vigilance / Auditor",
    blurb: "Audit decisions and the record trail.",
    tint: "gray",
    official: true,
    available: false,
    idField: { key: "employeeId", label: "Employee / service ID", placeholder: "As issued by your department" },
  },
};

/**
 * Account types a person can choose today. The gate officer is a view-only account that people on a case invite;
 * the other official roles have no screens yet and nothing verifies who claims one, so they stay out of sign-up
 * until an admin can provision them. The type is fixed once chosen.
 */
export const SELECTABLE_ROLES: readonly Role[] = ROLES.filter((r) => ROLE_INFO[r].available);

/** Accounts that can look at everything on a case they are on, but change nothing on it. */
export function isReadOnly(role: Role): boolean {
  return role === "gate_officer";
}

export function isSelectableRole(value: unknown): value is Role {
  return typeof value === "string" && (SELECTABLE_ROLES as readonly string[]).includes(value);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Who can invite whom to a case, down the chain of custody. Anyone who can add to a case can also bring in
 * a gate officer, who only views. The other officials appear in no list, so they are never invited.
 * The consignee can bring in a CHA and a transporter for buyer-arranged freight (EXW, FCA, FOB).
 */
export const INVITES: Partial<Record<Role, readonly Role[]>> = {
  consignor: ["consignee", "cha", "transporter", "gate_officer"],
  consignee: ["cha", "transporter", "gate_officer"],
  cha: ["transporter", "gate_officer"],
  transporter: ["driver", "gate_officer"],
  driver: ["gate_officer"],
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
