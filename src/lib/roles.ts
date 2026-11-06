/**
 * The 10 GateIQ account types. Any user may pick any role (product decision);
 * official roles carry a "government email domain" signal only (see verify/).
 */
export const ROLES = [
  "consignor",
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

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
