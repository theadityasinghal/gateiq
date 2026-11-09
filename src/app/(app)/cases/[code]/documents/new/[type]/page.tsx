import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireOnboardedUser } from "@/server/session";
import { getCaseForUser } from "@/server/cases/service";
import { getCurrencies, getMassUnits, getUqcUnits, masterStatus } from "@/server/masters";
import { MastersNotice } from "@/components/masters-notice";
import { DOC_TYPES, canAddDocument, docLabelInline, docTypeFromSlug } from "@/lib/documents";
import { ROLE_INFO } from "@/lib/roles";
import { listPhoneCountries } from "@/lib/phone";
import { ButtonLink } from "@/components/ui/button";
import { ShippingBillForm } from "./shipping-bill-form";
import { EwayBillForm } from "./eway-bill-form";
import { LorryReceiptForm } from "./lorry-receipt-form";
import { FileDocumentForm } from "./file-document-form";

type Props = { params: Promise<{ code: string; type: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = docTypeFromSlug((await params).type);
  return { title: type ? `Add ${docLabelInline(type)}` : "Add document" };
}

const INTRO: Partial<Record<keyof typeof DOC_TYPES, string>> = {
  shipping_bill:
    "Type the details exactly as they appear on the ICEGATE filing, not as they were entered in this case. Others on the case may add their own copy; GateIQ keeps every one and later shows where they disagree.",
  eway_bill:
    "Type the details exactly as they appear on the e-way bill from the GST portal. The vehicle number (Part B) is optional; if it changes, add the updated e-way bill as another entry.",
  lorry_receipt: "Type the details from the lorry receipt you issued for this consignment. The vehicle number is checked against the e-way bill and the truck at the gate.",
};

export default async function AddDocumentPage({ params }: Props) {
  const { code, type: slug } = await params;
  const type = docTypeFromSlug(slug);
  if (!type) notFound();
  const user = await requireOnboardedUser();
  const c = await getCaseForUser(code, user.id);
  if (!c) notFound();
  const info = DOC_TYPES[type];
  const back = `/cases/${c.caseCode}?tab=documents`;

  const header = (
    <>
      <p className="text-micro-upper text-steel">
        <a href={back} className="font-mono text-link-blue">{c.caseCode}</a> · Documents
      </p>
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">Add {docLabelInline(type)}</h1>
    </>
  );

  if (!canAddDocument(user.role, type)) {
    return (
      <div className="mx-auto max-w-[960px]">
        {header}
        <p className="mt-4 max-w-[680px] text-slate">
          A {ROLE_INFO[user.role].label} can&apos;t add this document. It can be added by: {info.issuers.map((r) => ROLE_INFO[r].label).join(", ")}.
        </p>
        <ButtonLink href={back} variant="secondary" className="mt-6">Back to the case</ButtonLink>
      </div>
    );
  }

  let form: React.ReactNode;
  let notice: React.ReactNode = null;
  if (type === "shipping_bill") {
    const [currencies, uqc, massUnits, status] = await Promise.all([getCurrencies(), getUqcUnits(), getMassUnits(), masterStatus()]);
    notice = <MastersNotice status={status} />;
    form = (
      <ShippingBillForm
        caseCode={c.caseCode}
        currencies={currencies.map((x) => ({ code: x.code, name: x.name }))}
        units={uqc.map((u) => ({ code: u.code, name: u.description }))}
        massUnits={massUnits.map((u) => ({ code: u.code, name: u.description }))}
      />
    );
  } else if (type === "eway_bill") {
    const [uqc, status] = await Promise.all([getUqcUnits(), masterStatus()]);
    notice = <MastersNotice status={status} />;
    form = <EwayBillForm caseCode={c.caseCode} units={uqc.map((u) => ({ code: u.code, name: u.description }))} />;
  } else if (type === "lorry_receipt") {
    form = <LorryReceiptForm caseCode={c.caseCode} countries={listPhoneCountries()} />;
  } else {
    form = <FileDocumentForm caseCode={c.caseCode} type={type} label={info.label} inlineLabel={docLabelInline(type)} />;
  }

  return (
    <div className="mx-auto max-w-[960px]">
      {header}
      <p className="mt-2 max-w-[680px] text-slate">
        {INTRO[type] ?? info.blurb} It will show on the case as added by you, a {ROLE_INFO[user.role].label}, and is marked{" "}
        <span className="font-medium text-charcoal">self-declared</span>. You can remove it later, but not edit it.
      </p>
      {notice}
      {form}
    </div>
  );
}
