import type { FilingSource, ReceivedFiling } from "./source";
import type { EwayBillFormInput, LorryReceiptFormInput, ShippingBillFormInput } from "@/lib/case-schema";
import type { EwayBillInput } from "@/lib/normalize/eway-bill";
import type { LorryReceiptInput } from "@/lib/normalize/lorry-receipt";

/** The consignor or CHA types the shipping bill from the ICEGATE filing. Nothing here is independently verified. */
export class ManualFilingSource implements FilingSource<ShippingBillFormInput> {
  readonly id = "manual" as const;

  async receive(form: ShippingBillFormInput): Promise<ReceivedFiling> {
    return {
      source: "manual",
      verification: "self_declared",
      raw: { enteredAs: "form", form },
      input: {
        sbNumber: form.sbNumber,
        sbDate: form.sbDate,
        portCode: form.portCode,
        exporterIec: form.exporterIec,
        exporterGstin: form.exporterGstin,
        consigneeName: form.consigneeName,
        currency: form.currency,
        totalPackages: form.totalPackages,
        grossWeight: form.grossWeight,
        netWeight: form.netWeight,
        weightUnit: form.weightUnit,
        lines: form.lines,
      },
    };
  }
}

/** Whoever generated the e-way bill types it from the GST portal. Nothing here is independently verified. */
export class ManualEwayBillSource implements FilingSource<EwayBillFormInput, EwayBillInput> {
  readonly id = "manual" as const;

  async receive(form: EwayBillFormInput): Promise<ReceivedFiling<EwayBillInput>> {
    return { source: "manual", verification: "self_declared", raw: { enteredAs: "form", form }, input: form };
  }
}

/** The transporter types the lorry receipt they issued. Nothing here is independently verified. */
export class ManualLorryReceiptSource implements FilingSource<LorryReceiptFormInput, LorryReceiptInput> {
  readonly id = "manual" as const;

  async receive(form: LorryReceiptFormInput): Promise<ReceivedFiling<LorryReceiptInput>> {
    return { source: "manual", verification: "self_declared", raw: { enteredAs: "form", form }, input: form };
  }
}
