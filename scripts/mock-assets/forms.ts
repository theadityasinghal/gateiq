/**
 * Turns a Ship into the exact values a person would type into each GateIQ form (keys match
 * src/lib/case-schema.ts). The documents printed in the PDFs are rendered from these same objects, so
 * "what the paper says" and "what the form should hold" cannot drift apart.
 */
import { gstinOf, totals, withBadCheckDigit, type Ship } from "./shipments";

type Form = Record<string, unknown>;

export type Forms = {
  caseForm: Form;
  shippingBill: Form;
  invoice: Form;
  packingList: Form;
  ewayBill: Form;
  lorryReceipt: Form;
  vgm: Form;
  form13: Form[];
  eSeal: Form[];
};

const kg = (n: number) => n;

export function baseForms(s: Ship): Forms {
  const t = totals(s);
  const goods = s.lines.map((l) => ({ description: l.description, hsCode: l.hsCode, quantity: l.quantity, uqc: l.uqc, value: l.valueUsd }));

  const caseForm: Form = {
    originPlace: s.originPlace,
    exportPortCode: s.portCode,
    destinationCountry: s.consignee.country,
    destinationPort: s.destPort,
    incoterm: s.incoterm,
    currency: s.currency,
    lines: s.lines.map((l) => ({
      description: l.description,
      hsCode: l.hsCode,
      quantity: l.quantity,
      uqc: l.uqc,
      netWeight: l.netKg,
      grossWeight: l.grossKg,
      weightUnit: "KGS",
      packages: l.packages,
      packageType: l.packageType,
      value: l.valueUsd,
    })),
    hazmat: s.hazmat,
    pharma: null,
    perishable: null,
  };

  const shippingBill: Form = {
    sbNumber: s.sb.no,
    sbDate: s.sb.date,
    portCode: s.portCode,
    exporterIec: s.exporter.iec,
    exporterGstin: s.exporter.gstin,
    consigneeName: s.consignee.name,
    currency: s.currency,
    totalPackages: t.packages,
    grossWeight: kg(t.grossKg),
    netWeight: kg(t.netKg),
    weightUnit: "KGS",
    lines: goods,
    containers: s.boxes.map((b) => ({ containerNo: b.no, sizeType: b.sizeType, sealNo: b.eSeal })),
  };

  const invoice: Form = {
    invoiceNumber: s.invoice.no,
    invoiceDate: s.invoice.date,
    exporterGstin: s.exporter.gstin,
    buyerName: s.buyerNameOnInvoice,
    destinationCountry: s.consignee.country,
    currency: s.currency,
    irn: "", // filled by generate.ts (a hash of seller GSTIN, invoice number, financial year and type)
    lines: goods,
  };

  const packingList: Form = {
    invoiceNumber: s.invoice.no,
    invoiceDate: s.invoice.date,
    totalPackages: t.packages,
    grossWeight: kg(t.grossKg),
    netWeight: kg(t.netKg),
    weightUnit: "KGS",
    containers: s.boxes.map((b) => ({ containerNo: b.no })),
  };

  const ewayBill: Form = {
    ewbNumber: s.ewb.no,
    ewbDate: s.ewb.date,
    validUntil: s.ewb.validUntil,
    fromGstin: s.exporter.gstin,
    toGstin: "URP",
    fromPincode: s.ewb.fromPin,
    toPincode: s.ewb.toPin,
    docType: "INV",
    docNumber: s.invoice.no,
    docDate: s.invoice.date,
    transportMode: "ROAD",
    distanceKm: s.ewb.distanceKm,
    transporterId: s.transporter.gstin,
    vehicleNumber: s.ewb.vehicle,
    lines: s.lines.map((l) => ({ description: l.description, hsCode: l.hsCode, quantity: l.quantity, uqc: l.uqc, value: l.valueUsd * s.inrPerUsd })),
  };

  const lorryReceipt: Form = {
    lrNumber: s.lr.no,
    lrDate: s.lr.date,
    vehicleNumber: s.lr.vehicle,
    driverName: s.lr.driver,
    driverPhone: s.lr.phone,
    driverPhoneCountry: "IN",
    fromPlace: s.lr.from,
    toPlace: s.lr.to,
    packages: t.packages,
    goodsDescription: s.lines.map((l) => l.description.split(",")[0]).join("; "),
    chargedWeight: s.lr.chargedKg,
    weightUnit: "KGS",
    containers: s.boxes.map((b) => ({ containerNo: b.no })),
  };

  const vgm: Form = {
    bookingNo: s.booking,
    shipperName: s.exporter.name,
    shipperIec: s.exporter.iec,
    method: "1",
    weighingSlipNo: s.vgm.slip,
    weighbridgeRegNo: s.vgm.weighbridge,
    weighedOn: s.vgm.weighedOn,
    containers: s.boxes.map((b) => ({ containerNo: b.no, vgmKg: b.cargoGrossKg + b.tareKg, tareKg: b.tareKg })),
  };

  const form13: Form[] = s.boxes.map((b) => ({
    bookingNo: s.booking,
    containerNo: b.no,
    isoCode: b.sizeType,
    lineSealNo: b.lineSeal,
    eSealNo: b.eSeal,
    vgm: b.cargoGrossKg + b.tareKg,
    vgmUnit: "KGS",
    sbNumber: s.sb.no,
    chaLicence: s.cha.licence,
    shipperName: s.exporter.name,
    pod: s.podLocode,
    vesselCall: s.vessel,
    vehicleNumber: s.lr.vehicle,
    issuedOn: s.f13On,
  }));

  const eSeal: Form[] = s.boxes.map((b) => ({
    eSealNo: b.eSeal,
    containerNo: b.no,
    sbNumber: s.sb.no,
    sbDate: s.sb.date,
    iec: s.exporter.iec,
    truckNumber: s.lr.vehicle,
    sealedOn: s.sealedOn,
  }));

  return { caseForm, shippingBill, invoice, packingList, ewayBill, lorryReceipt, vgm, form13, eSeal };
}

/**
 * Scenario B's mistakes, applied to the consistent base. Each one is a thing that really goes wrong on
 * shipments; the README lists what the Checks tab should say for each.
 */
export function plantProblems(s: Ship, f: Forms): Forms {
  const box = s.boxes[0];
  const swapped = (n: string) => n.slice(0, 5) + n[6] + n[5] + n.slice(7); // 8204761 → 8204716
  return {
    ...f,
    // 1. The packing list has the container number with a mistyped check digit.
    packingList: { ...f.packingList, containers: [{ containerNo: withBadCheckDigit(box.no) }] },
    // 2. The e-seal record has two digits of the shipping bill number swapped.
    eSeal: f.eSeal.map((e) => ({ ...e, sbNumber: swapped(String(e.sbNumber)) })),
    // 3. The invoice names the buyer slightly differently from the shipping bill and the consignee account.
    invoice: { ...f.invoice, buyerName: "Nordic Textile Imports Trading GmbH" },
    // 4. The lorry receipt: charged weight rounded up for billing, and 20 cartons short on the count.
    lorryReceipt: { ...f.lorryReceipt, chargedWeight: 4500, packages: 580 },
    // 5. The e-way bill expired three days ago and has no vehicle (Part B never filled in).
    ewayBill: { ...f.ewayBill, vehicleNumber: "" },
    // 6. Form-13 has the truck's last two digits swapped (TN39BX7712 → TN39BX7721).
    form13: f.form13.map((x) => ({ ...x, vehicleNumber: "TN39BX7721" })),
    // 7. The VGM declaration shows the weight in tonnes (7.82) under a kilogram heading.
    vgm: { ...f.vgm, containers: [{ containerNo: box.no, vgmKg: 7.82, tareKg: box.tareKg }] },
  };
}

export { gstinOf };
