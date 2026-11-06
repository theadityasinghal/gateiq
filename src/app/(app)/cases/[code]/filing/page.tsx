import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/session";
import { getOwnedCase, getShippingBillBaseline } from "@/server/cases/service";
import { getCurrencies, getMassUnits, getUqcUnits, masterStatus } from "@/server/masters";
import { MastersNotice } from "@/components/masters-notice";
import { FilingForm } from "./filing-form";

export const metadata = { title: "Record shipping bill" };

export default async function FilingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireOnboardedUser();
  if (user.role !== "consignor") redirect("/dashboard");
  const c = await getOwnedCase(code, user.id);
  if (!c) notFound();
  const [sb, currencies, uqc, massUnits, status] = await Promise.all([
    getShippingBillBaseline(c.id),
    getCurrencies(),
    getUqcUnits(),
    getMassUnits(),
    masterStatus(),
  ]);

  return (
    <div className="mx-auto max-w-[960px]">
      <p className="text-micro-upper text-steel">
        <a href={`/cases/${c.caseCode}?tab=filing`} className="font-mono text-link-blue">{c.caseCode}</a> · Filing
      </p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">
        {sb ? `Revise shipping bill (version ${sb.versions + 1})` : "Record shipping bill"}
      </h1>
      <p className="mt-2 max-w-[680px] text-slate">
        Type the details exactly as they appear on your ICEGATE filing, not as you declared them in this case, or the comparison will hide real differences. This entry is marked <span className="font-medium text-charcoal">self-declared</span> until GateIQ can fetch the shipping bill from ICEGATE itself.
      </p>
      <MastersNotice status={status} />
      <FilingForm
        caseCode={c.caseCode}
        currencies={currencies.map((x) => ({ code: x.code, name: x.name }))}
        units={uqc.map((u) => ({ code: u.code, name: u.description }))}
        massUnits={massUnits.map((u) => ({ code: u.code, name: u.description }))}
        previous={sb?.baseline.normalized ?? null}
      />
    </div>
  );
}
