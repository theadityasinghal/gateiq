/** Incoterms® 2020 rules (ICC). Reference data. */
export const INCOTERMS_2020 = [
  { code: "EXW", name: "Ex Works" },
  { code: "FCA", name: "Free Carrier" },
  { code: "CPT", name: "Carriage Paid To" },
  { code: "CIP", name: "Carriage and Insurance Paid To" },
  { code: "DAP", name: "Delivered at Place" },
  { code: "DPU", name: "Delivered at Place Unloaded" },
  { code: "DDP", name: "Delivered Duty Paid" },
  { code: "FAS", name: "Free Alongside Ship" },
  { code: "FOB", name: "Free on Board" },
  { code: "CFR", name: "Cost and Freight" },
  { code: "CIF", name: "Cost, Insurance and Freight" },
] as const;

export const INCOTERM_CODES = INCOTERMS_2020.map((i) => i.code) as unknown as readonly [string, ...string[]];

/** Certificates commonly required for perishable exports. */
export const PERISHABLE_CERTIFICATES = [
  "Phytosanitary certificate",
  "Fumigation certificate",
  "Health certificate",
  "Quality / inspection certificate",
  "Certificate of origin",
] as const;
