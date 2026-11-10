import type { FilingSource, ReceivedFiling } from "./source";
import type { ShippingBillFormInput } from "@/lib/case-schema";

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
        containers: form.containers,
      },
    };
  }
}
