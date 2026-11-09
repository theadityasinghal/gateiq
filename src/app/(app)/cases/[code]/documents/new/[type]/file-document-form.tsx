"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import type { DocType } from "@/lib/documents";
import { addFileDocument, type SubmissionFormState } from "@/server/cases/submissions";
import { AttachFile } from "./attach-file";

export function FileDocumentForm({ caseCode, type, label, inlineLabel }: { caseCode: string; type: DocType; label: string; inlineLabel: string }) {
  const [state, action, pending] = useActionState<SubmissionFormState, FormData>(addFileDocument.bind(null, caseCode, type), {});
  const err = (k: string) => state.fieldErrors?.[k];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="mt-8 space-y-6" noValidate>
      <AttachFile required title={label} error={err("file")} />
      <Card>
        <SectionTitle title="Details (optional)" description="If the document carries a number and date, add them so it can be matched with the others." />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Document number" htmlFor="documentNumber" error={err("documentNumber")}>
            <Input id="documentNumber" name="documentNumber" maxLength={60} className="font-mono uppercase" />
          </Field>
          <Field label="Document date" htmlFor="documentDate" error={err("documentDate")}>
            <Input id="documentDate" name="documentDate" type="date" max={today} />
          </Field>
        </div>
      </Card>

      {state.error || state.fieldErrors ? (
        <p role="alert" className="text-body-sm text-error">{state.error ?? "Some fields need attention. They are marked above."}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Uploading…" : `Add ${inlineLabel}`}</Button>
      </div>
    </form>
  );
}
