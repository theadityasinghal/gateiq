import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireOnboardedUser } from "@/server/session";
import { getCaseForUser } from "@/server/cases/service";
import { getOwnSubmissionForCorrection } from "@/server/cases/checks";
import { getCurrencies, getMassUnits, getUqcUnits, masterStatus } from "@/server/masters";
import { MastersNotice } from "@/components/masters-notice";
import { DOC_TYPES, canAddDocument, docLabelInline, docTypeFromSlug } from "@/lib/documents";
import { ROLE_INFO } from "@/lib/roles";
import { listPhoneCountries } from "@/lib/phone";
import { ButtonLink } from "@/components/ui/button";
import { DOC_FORMS, type OptionSource, type StaticOption } from "@/lib/doc-forms";
import { StructuredDocForm } from "./structured-doc-form";
import { FileDocumentForm } from "./file-document-form";

type Props = { params: Promise<{ code: string; type: string }>; searchParams: Promise<{ correct?: string }> };

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
  form_13: "Type the e-Form-13 the shipping line issued for one container. Its container, seal and VGM are checked against the shipping bill, e-seal record and VGM declaration.",
  vgm_declaration: "Type the VGM declaration given to the shipping line. Each container's VGM, less its tare, is compared with the shipping bill's gross weight.",
  e_seal: "Type what was uploaded through the e-seal vendor's app. The seal ties the container number to the shipping bill and the truck.",
  commercial_invoice: "Type the invoice as printed. Its number, date, GSTIN and HS codes are compared with the shipping bill and e-way bill.",
  packing_list: "Type the totals from the packing list. Packages and weight are compared with the shipping bill and lorry receipt.",
};

/** Codes used in currencies are loaded from the masters; masters that aren't imported give empty lists. */
async function loadOptions(): Promise<Record<OptionSource, StaticOption[]>> {
  const [currencies, uqc, massUnits] = await Promise.all([getCurrencies(), getUqcUnits(), getMassUnits()]);
  return {
    currencies: currencies.map((x) => ({ value: x.code, label: `${x.code} · ${x.name}` })),
    uqc: uqc.map((u) => ({ value: u.code, label: `${u.code} · ${u.description}` })),
    massUnits: massUnits.map((u) => ({ value: u.code, label: `${u.code} · ${u.description}` })),
    phoneCountries: listPhoneCountries().map((c) => ({ value: c.code, label: `${c.code} +${c.dial}  ${c.name}` })),
  };
}

const USES_MASTERS = new Set(["shipping_bill", "eway_bill", "commercial_invoice"]);

export default async function AddDocumentPage({ params, searchParams }: Props) {
  const [{ code, type: slug }, { correct }] = await Promise.all([params, searchParams]);
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
      <h1 className="mt-2 text-[32px] font-semibold leading-[1.2] tracking-[-0.5px] sm:text-h2">
        {correct ? "Correct" : "Add"} {docLabelInline(type)}
      </h1>
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
  const correcting = correct ? await getOwnSubmissionForCorrection(c.id, correct, user.id) : null;
  if (correct && (!correcting || correcting.type !== type)) {
    return (
      <div className="mx-auto max-w-[960px]">
        {header}
        <p className="mt-4 max-w-[680px] text-slate">This document can&apos;t be corrected: it was removed, already corrected, or added by someone else.</p>
        <ButtonLink href={back} variant="secondary" className="mt-6">Back to the case</ButtonLink>
      </div>
    );
  }
  if (DOC_FORMS[type]) {
    const [options, status] = await Promise.all([loadOptions(), masterStatus()]);
    if (USES_MASTERS.has(type)) notice = <MastersNotice status={status} />;
    form = (
      <StructuredDocForm
        caseCode={c.caseCode}
        type={type}
        options={options}
        initial={correcting?.form}
        hidden={correcting ? { supersedesId: correcting.id } : undefined}
      />
    );
  } else {
    form = <FileDocumentForm caseCode={c.caseCode} type={type} label={info.label} inlineLabel={docLabelInline(type)} />;
  }

  return (
    <div className="mx-auto max-w-[960px]">
      {header}
      <p className="mt-2 max-w-[680px] text-slate">
        {INTRO[type] ?? info.blurb} It will show on the case as added by you, a {ROLE_INFO[user.role].label}, and is marked{" "}
        <span className="font-medium text-charcoal">self-declared</span>.{" "}
        {correcting
          ? "Saving keeps the earlier version in the record trail and shows this one in its place. Its file carries over unless you attach a new one."
          : "You can correct or remove it later; earlier versions stay in the record trail."}
      </p>
      {notice}
      {form}
    </div>
  );
}
