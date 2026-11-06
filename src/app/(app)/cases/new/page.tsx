import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/server/session";
import { getCountries, getCurrencies, getMassUnits, getUqcUnits, masterStatus } from "@/server/masters";
import { MastersNotice } from "@/components/masters-notice";
import { CaseForm } from "./case-form";

export const metadata = { title: "New case" };

export default async function NewCasePage() {
  const user = await requireOnboardedUser();
  if (user.role !== "consignor") redirect("/dashboard");
  const [countries, currencies, uqc, massUnits, status] = await Promise.all([
    getCountries(),
    getCurrencies(),
    getUqcUnits(),
    getMassUnits(),
    masterStatus(),
  ]);

  return (
    <div className="mx-auto max-w-[960px]">
      <p className="text-micro-upper text-steel">New case</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">Describe the consignment</h1>
      <p className="mt-2 max-w-[640px] text-slate">
        Record what you are sending. Once you file the shipping bill on ICEGATE, you&apos;ll attach it to this case and GateIQ will compare the two.
      </p>
      <MastersNotice status={status} />
      <CaseForm
        countries={countries.map((c) => ({ code: c.code, name: c.name }))}
        currencies={currencies.map((c) => ({ code: c.code, name: c.name }))}
        units={uqc.map((u) => ({ code: u.code, name: u.description }))}
        massUnits={massUnits.map((u) => ({ code: u.code, name: u.description }))}
      />
    </div>
  );
}
