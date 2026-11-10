import { Info, TriangleExclamationPoint } from "lucide-react";

type Status = { ports: number; hsCodes: number; uqc: number; currencies: number; countries: number };

/** Tells the user which reference lists are missing, so nothing silently looks "checked". */
export function MastersNotice({ status }: { status: Status }) {
  const missing = [
    status.uqc === 0 && "units (UQC)",
    status.currencies === 0 && "currencies",
    status.countries === 0 && "countries",
  ].filter(Boolean) as string[];
  const unchecked = [status.ports === 0 && "customs location codes", status.hsCodes === 0 && "ITC-HS codes"].filter(Boolean) as string[];
  if (!missing.length && !unchecked.length) return null;
  return (
    <div className="mt-6 space-y-1 rounded-lg bg-tint-yellow p-5 text-body-sm text-charcoal" role="status">
      {missing.length ? (
        <p className="flex items-start gap-2">
          <TriangleExclamationPoint size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-tag-orange-fg" aria-hidden="true" />
          <span><span className="font-semibold">Reference data missing:</span> {missing.join(", ")}. Run{" "}
          <code className="rounded-xs bg-canvas px-1">npm run masters:import</code> before creating cases.</span>
        </p>
      ) : null}
      {unchecked.length ? (
        <p className="flex items-start gap-2">
          <Info size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-steel" aria-hidden="true" />
          <span><span className="font-semibold">Not imported yet:</span> {unchecked.join(" and ")}. These codes are checked for format only until the official lists are loaded.</span>
        </p>
      ) : null}
    </div>
  );
}
