import type { ShippingBillInput } from "@/lib/normalize/shipping-bill";

export type FilingVerification = "self_declared" | "source_verified";

/** What any source hands to the pipeline: the raw record exactly as received, plus its mapping to the standard input. */
export type ReceivedFiling = {
  source: "manual" | "ulip";
  verification: FilingVerification;
  /** Stored verbatim in filing_raw_record (append-only). */
  raw: unknown;
  /** The same record mapped into the shape the normaliser accepts. */
  input: ShippingBillInput;
};

/**
 * One slot for every way a filed shipping bill reaches GateIQ.
 * Now: ManualFilingSource (typed by the consignor). Later: UlipFilingSource (fetched from ICEGATE via ULIP).
 * Everything downstream (raw store, normaliser, baseline, diff) is the same for both.
 */
export interface FilingSource<Request> {
  readonly id: "manual" | "ulip";
  receive(request: Request): Promise<ReceivedFiling>;
}
