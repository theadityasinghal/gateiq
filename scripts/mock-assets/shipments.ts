/**
 * The three fictional consignments behind the mock documents, and the exact form values for every document
 * of each. Every value passes the app's own schemas (see generate.ts, which parses them) and the identifiers
 * (GSTIN, IEC, container numbers) carry valid check digits. Planted mistakes (scenario B) are applied on top
 * of the consistent base in `plantProblems`, so what is wrong is visible in one place.
 */
import { containerCheckDigit } from "@/lib/iso6346";
import { gstinCheckChar } from "@/lib/verify/identifiers";

/** A day relative to today, in UTC (the app compares dates against UTC today). */
export function day(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const gstinOf = (state: string, pan: string, entity = "1") => {
  const first14 = `${state}${pan}${entity}Z`;
  return first14 + gstinCheckChar(first14);
};

export const containerNo = (owner: string, serial: string) => {
  const first10 = `${owner}U${serial}`;
  return first10 + containerCheckDigit(first10);
};

/** The same number with a wrong check digit: the typo scenario B plants. */
export const withBadCheckDigit = (no: string) => no.slice(0, 10) + String((Number(no[10]) + 3) % 10);

export type Party = { name: string; address: string; pin: string; state: string; pan: string; gstin: string; iec: string };
export type Box = { no: string; sizeType: string; lineSeal: string; eSeal: string; tareKg: number; cargoGrossKg: number; packages: number };
export type Line = { description: string; hsCode: string; quantity: number; uqc: string; netKg: number; grossKg: number; packages: number; packageType: string; valueUsd: number };

export type Ship = {
  id: "A" | "B" | "C";
  folder: string;
  title: string;
  exporter: Party;
  transporter: { name: string; address: string; gstin: string };
  consignee: { name: string; address: string; country: string; countryName: string };
  cha: { name: string; licence: string };
  originPlace: string;
  portCode: string;
  portName: string;
  destPort: string;
  podLocode: string;
  vessel: string;
  incoterm: string;
  currency: "USD";
  inrPerUsd: number;
  lines: Line[];
  boxes: Box[];
  hazmat: { unNumber: string; hazardClass: string } | null;
  booking: string;
  sb: { no: string; date: string };
  invoice: { no: string; date: string };
  ewb: { no: string; date: string; validUntil: string | null; fromPin: string; toPin: string; distanceKm: number; vehicle: string | null };
  lr: { no: string; date: string; vehicle: string; driver: string; phone: string; from: string; to: string; chargedKg: number };
  vgm: { slip: string; weighbridge: string; weighedOn: string };
  sealedOn: string;
  f13On: string;
  buyerNameOnInvoice: string;
};

function party(name: string, address: string, pin: string, state: string, pan: string): Party {
  return { name, address, pin, state, pan, gstin: gstinOf(state, pan), iec: pan };
}

export const totals = (s: Ship) => ({
  packages: s.lines.reduce((a, l) => a + l.packages, 0),
  netKg: s.lines.reduce((a, l) => a + l.netKg, 0),
  grossKg: s.lines.reduce((a, l) => a + l.grossKg, 0),
  valueUsd: s.lines.reduce((a, l) => a + l.valueUsd, 0),
});

/* ───────────── A: clean, one 40 ft container of basmati rice ───────────── */

const aExporter = party("Orchid Valley Agro Exports Pvt Ltd", "Plot 14, MIDC Chakan Phase II, Pune, Maharashtra 410501", "410501", "27", "AAGCO4821K");

export const A: Ship = {
  id: "A",
  folder: "A_clean",
  title: "Clean: one 40 ft container of basmati rice",
  exporter: aExporter,
  transporter: { name: "Konkan Carriers Pvt Ltd", address: "Gala 7, Turbhe MIDC, Navi Mumbai 400705", gstin: gstinOf("27", "AAFCK7712M") },
  consignee: { name: "Gulf Fresh Trading FZE", address: "Office 2207, JAFZA One, Jebel Ali Free Zone, Dubai", country: "AE", countryName: "United Arab Emirates" },
  cha: { name: "Marathon Customs Services", licence: "CHA/MUM/2291" },
  originPlace: "Pune, Maharashtra",
  portCode: "INNSA1",
  portName: "Nhava Sheva (JNPT)",
  destPort: "Jebel Ali",
  podLocode: "AEJEA",
  vessel: "HARMONY 418E",
  incoterm: "FOB",
  currency: "USD",
  inrPerUsd: 84,
  lines: [
    {
      description: "Basmati rice, 1121 steam, packed in 25 kg PP bags",
      hsCode: "10063020",
      quantity: 24000,
      uqc: "KGS",
      netKg: 24000,
      grossKg: 24480,
      packages: 960,
      packageType: "PP bags",
      valueUsd: 24000,
    },
  ],
  boxes: [{ no: containerNo("GIQ", "481209"), sizeType: "45G1", lineSeal: "LS558203", eSeal: "ES70014829", tareKg: 3780, cargoGrossKg: 24480, packages: 960 }],
  hazmat: null,
  booking: "NSA26104812",
  sb: { no: "7104829", date: day(-3) },
  invoice: { no: "OVA/26-27/0412", date: day(-6) },
  ewb: { no: "271500004821", date: day(-1), validUntil: day(4), fromPin: "410501", toPin: "400707", distanceKm: 160, vehicle: "MH12AB4821" },
  lr: { no: "KC/PUN/26/08812", date: day(-1), vehicle: "MH12AB4821", driver: "Ramesh Kadam", phone: "9876543210", from: "Chakan, Pune", to: "JNPT, Nhava Sheva", chargedKg: 24500 },
  vgm: { slip: "WS-48210", weighbridge: "WB/NSA/118", weighedOn: day(-1) },
  sealedOn: day(-1),
  f13On: day(-1),
  buyerNameOnInvoice: "Gulf Fresh Trading FZE",
};

/* ───────────── B: planted problems, one 40 ft container of T-shirts ───────────── */

const bExporter = party("Indigo Loom Garments Pvt Ltd", "88, Kangeyam Road, Tiruppur, Tamil Nadu 641604", "641604", "33", "AAHCI3306R");

export const B: Ship = {
  id: "B",
  folder: "B_planted-problems",
  title: "Planted problems: one 40 ft container of cotton T-shirts",
  exporter: bExporter,
  transporter: { name: "Coromandel Freight Lines", address: "12, Mount Road, Chennai 600002", gstin: gstinOf("33", "AAKCC5521D") },
  consignee: { name: "Nordic Textile Imports GmbH", address: "Speicherstrasse 41, 20457 Hamburg", country: "DE", countryName: "Germany" },
  cha: { name: "Southern Cross Customs Agency", licence: "CHA/MAA/1174" },
  originPlace: "Tiruppur, Tamil Nadu",
  portCode: "INMAA1",
  portName: "Chennai",
  destPort: "Hamburg",
  podLocode: "DEHAM",
  vessel: "BALTIC STAR 207W",
  incoterm: "FOB",
  currency: "USD",
  inrPerUsd: 84,
  lines: [
    {
      description: "Men's cotton knitted T-shirts, round neck, assorted sizes",
      hsCode: "61091000",
      quantity: 18000,
      uqc: "PCS",
      netKg: 3600,
      grossKg: 4080,
      packages: 600,
      packageType: "Cartons",
      valueUsd: 54000,
    },
  ],
  boxes: [{ no: containerNo("GIQ", "332017"), sizeType: "42G1", lineSeal: "LS771045", eSeal: "ES80233051", tareKg: 3740, cargoGrossKg: 4080, packages: 600 }],
  hazmat: null,
  booking: "MAA26077315",
  sb: { no: "8204761", date: day(-4) },
  invoice: { no: "ILG/26-27/0188", date: day(-8) },
  ewb: { no: "331500007712", date: day(-7), validUntil: day(-4), fromPin: "641604", toPin: "600001", distanceKm: 480, vehicle: "TN39BX7712" },
  lr: { no: "CFL/TPR/26/3301", date: day(-2), vehicle: "TN39BX7712", driver: "Selvam Murugan", phone: "9876501234", from: "Tiruppur", to: "Chennai Port", chargedKg: 4080 },
  vgm: { slip: "WS-77310", weighbridge: "WB/MAA/042", weighedOn: day(-2) },
  sealedOn: day(-2),
  f13On: day(-2),
  buyerNameOnInvoice: "Nordic Textile Imports GmbH",
};

/* ───────────── C: two 20 ft containers of isopropyl alcohol (hazardous) ───────────── */

const cExporter = party("Rajhans Solvents Pvt Ltd", "Survey 212, Naroda GIDC, Ahmedabad, Gujarat 382330", "382330", "24", "AAJCR9034Q");

export const C: Ship = {
  id: "C",
  folder: "C_two-containers-hazmat",
  title: "Two 20 ft containers of isopropyl alcohol (UN1219, class 3)",
  exporter: cExporter,
  transporter: { name: "Saurashtra Roadways Pvt Ltd", address: "Transport Nagar, Gandhidham, Gujarat 370201", gstin: gstinOf("24", "AAMCS1187H") },
  consignee: { name: "Al Noor Chemicals LLC", address: "Industrial Area 2, Dammam", country: "SA", countryName: "Saudi Arabia" },
  cha: { name: "Kutch Gateway Clearing", licence: "CHA/MUN/0839" },
  originPlace: "Ahmedabad, Gujarat",
  portCode: "INMUN1",
  portName: "Mundra",
  destPort: "Dammam",
  podLocode: "SADMM",
  vessel: "RED SEA EXPRESS 33S",
  incoterm: "CFR",
  currency: "USD",
  inrPerUsd: 84,
  lines: [
    {
      description: "Isopropyl alcohol (propan-2-ol), 99.9% purity, in 200 litre steel drums",
      hsCode: "29051220",
      quantity: 25120,
      uqc: "KGS",
      netKg: 25120,
      grossKg: 28320,
      packages: 160,
      packageType: "Steel drums",
      valueUsd: 40192,
    },
  ],
  boxes: [
    { no: containerNo("GIQ", "700145"), sizeType: "22G1", lineSeal: "LS900117", eSeal: "ES91005512", tareKg: 2200, cargoGrossKg: 14160, packages: 80 },
    { no: containerNo("GIQ", "700152"), sizeType: "22G1", lineSeal: "LS900118", eSeal: "ES91005513", tareKg: 2180, cargoGrossKg: 14160, packages: 80 },
  ],
  hazmat: { unNumber: "UN1219", hazardClass: "3" },
  booking: "MUN26203390",
  sb: { no: "9317055", date: day(-3) },
  invoice: { no: "RSP/26-27/0731", date: day(-7) },
  ewb: { no: "241500009034", date: day(-2), validUntil: day(3), fromPin: "382330", toPin: "370421", distanceKm: 330, vehicle: "GJ01CD5678" },
  lr: { no: "SR/AMD/26/5120", date: day(-2), vehicle: "GJ01CD5678", driver: "Bharat Rabari", phone: "9876512345", from: "Naroda, Ahmedabad", to: "Mundra Port", chargedKg: 28400 },
  vgm: { slip: "WS-20339", weighbridge: "WB/MUN/207", weighedOn: day(-1) },
  sealedOn: day(-1),
  f13On: day(-1),
  buyerNameOnInvoice: "Al Noor Chemicals LLC",
};
