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
import { DocEntry } from "./doc-entry";
import { geminiConfigured } from "@/server/extract/gemini";

/** Reading a file calls the vision model from a Server Action on this page; give it time. */
export const maxDuration = 60;
import { FileDocumentForm } from "./file-document-form";

type Props = { params: Promise<{ code: string; type: string }>; searchParams: Promise<{ correct?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const type = docTypeFromSlug((await params).type);
  return { title: type ? `Add ${docLabelInline(type)}` : "Add document" };
}

/** One line on what to copy from; what each field is compared with shows on the Checks tab. */
const INTRO: Partial<Record<keyof typeof DOC_TYPES, string>> = {
  shipping_bill: "As filed on ICEGATE, not as entered in this case.",
  eway_bill: "As generated on the GST portal. Part B can be added later as a new entry.",
  lorry_receipt: "The LR you issued for this consignment.",
  form_13: "One per container, as issued by the shipping line.",
  vgm_declaration: "As given to the shipping line. VGM includes the empty container.",
  e_seal: "As uploaded through the e-seal vendor's app.",
  commercial_invoice: "As printed on the invoice.",
  packing_list: "The totals from the packing list.",
}

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
  const back = `/cases/${c.caseCode}/documents`;

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
    form = correcting ? (
      <StructuredDocForm
        caseCode={c.caseCode}
        type={type}
        options={options}
        initial={correcting.form}
        hidden={{ supersedesId: correcting.id }}
        submitLabel="Save correction"
        attachNote={null}
      />
    ) : (
      <DocEntry
        caseCode={c.caseCode}
        type={type}
        label={docLabelInline(type)}
        options={options}
        canRead={geminiConfigured()}
        hasQr={type === "commercial_invoice" || type === "eway_bill"}
      />
    );
  } else {
    form = <FileDocumentForm caseCode={c.caseCode} type={type} label={info.label} inlineLabel={docLabelInline(type)} />;
  }

  return (
    <div className="mx-auto max-w-[960px]">
      {header}
      <p className="mt-2 max-w-[680px] text-slate">
        {INTRO[type] ?? info.blurb}
        {correcting ? " The earlier version stays in the record trail; its file carries over unless you attach a new one." : null}
      </p>
      {notice}
      {form}
    </div>
  );
}
