import type { ShippingBillInput } from "@/lib/normalize/shipping-bill";

export type FilingVerification = "self_declared" | "source_verified";

/** What any source hands to the pipeline: the raw record exactly as received, plus its mapping to the standard input. */
export type ReceivedFiling<Input = ShippingBillInput> = {
  source: "manual" | "ulip";
  verification: FilingVerification;
  /** Stored verbatim on the submission (never edited). */
  raw: unknown;
  /** The same record mapped into the shape the normaliser accepts. */
  input: Input;
};

/**
 * One slot for every way a filed document reaches GateIQ.
 * Now: manual sources (typed by whoever adds the document). Later: ICEGATE / e-way bill API via ULIP.
 * Everything downstream (raw store, normaliser, submission) is the same for all of them.
 */
export interface FilingSource<Request, Input = ShippingBillInput> {
  readonly id: "manual" | "ulip";
  receive(request: Request): Promise<ReceivedFiling<Input>>;
}
