"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/badge";
import type { DocType } from "@/lib/documents";
import type { OptionSource, StaticOption } from "@/lib/doc-forms";
import { decodeQrFromFile } from "@/lib/qr/decode-client";
import { extractDocument, type ExtractState } from "@/server/cases/extraction";
import { StructuredDocForm } from "./structured-doc-form";

const MAX_BYTES = 3.5 * 1024 * 1024;

/** Phone photos are often bigger than the upload limit: shrink them in the browser first. */
async function fitImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= MAX_BYTES) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  for (const q of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= MAX_BYTES) return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  }
  return file;
}

/**
 * Two ways to add a structured document: read it from a photo or PDF (QR code first, then the vision
 * model) and confirm the pre-filled form, or type it in. Either way the same form is what gets saved.
 */
export function DocEntry({
  caseCode,
  type,
  label,
  options,
  canRead,
  hasQr,
}: {
  caseCode: string;
  type: DocType;
  label: string;
  options: Record<OptionSource, StaticOption[]>;
  /** The vision model is configured. */
  canRead: boolean;
  /** This type usually carries a QR code GateIQ can read. */
  hasQr: boolean;
}) {
  const [mode, setMode] = useState<"read" | "type">(canRead || hasQr ? "read" : "type");
  const [state, action, pending] = useActionState<ExtractState, FormData>(extractDocument.bind(null, caseCode, type), {});
  const [step, setStep] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; isPdf: boolean } | null>(null);

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview.url) : undefined), [preview]);

  async function read(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const picked = input.files?.[0];
    if (!picked) return setLocalError("Choose a photo or PDF first.");
    setStep("Looking for a QR code…");
    const file = await fitImage(picked);
    if (file.size > MAX_BYTES) {
      setStep(null);
      return setLocalError("The file must be under 3.5 MB. Try a smaller PDF or photo.");
    }
    const qrText = await decodeQrFromFile(file);
    setPreview({ url: URL.createObjectURL(file), isPdf: file.type === "application/pdf" });
    setStep(canRead ? "Reading the document… this can take up to a minute." : "Reading the QR code…");
    const fd = new FormData();
    fd.set("file", file);
    if (qrText) fd.set("qrText", qrText);
    startTransition(() => action(fd));
  }

  const r = state.result;
  if (r) {
    const fromQr = Object.values(r.meta).filter((m) => m.source === "qr").length;
    const toCheck = Object.values(r.meta).filter((m) => m.source === "model" && (m.problem || (m.confidence ?? 0) < 0.8)).length;
    return (
      <div className="mt-8 space-y-6">
        <Card>
          <SectionTitle title="Check what was read" description="Nothing is added to the case until you save. Compare each field with the paper; correct anything that's wrong." />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body-sm text-charcoal">{r.fileName}</span>
            {r.usedQr ? <Tag tone="sky">{fromQr} from the QR code</Tag> : null}
            {r.usedModel ? <Tag tone="gray">Read by Gemini</Tag> : null}
            {toCheck ? <Tag tone="orange">{toCheck} to check</Tag> : null}
          </div>
          {r.warning ? <p role="alert" className="mt-3 rounded-md bg-tint-peach p-3 text-body-sm text-tag-orange-fg">{r.warning}</p> : null}
          {r.usedQr ? (
            <p className="mt-3 text-caption text-steel">
              QR values are copied exactly from the code. Its digital signature isn&apos;t checked yet.
              {Object.keys(r.qrExtras).length ? <> Also in the QR code: {Object.entries(r.qrExtras).map(([k, v]) => `${k}: ${v}`).join(" · ")}.</> : null}
            </p>
          ) : null}
          {preview ? (
            preview.isPdf ? (
              <a href={preview.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-body-sm font-medium text-link-blue">Open the PDF to compare</a>
            ) : (
              <a href={preview.url} target="_blank" rel="noreferrer" className="mt-4 block">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a remote image */}
                <img src={preview.url} alt={`The ${label} you uploaded`} className="max-h-[420px] rounded-md border border-hairline object-contain" />
              </a>
            )
          ) : null}
        </Card>
        <StructuredDocForm
          key={r.extractionId}
          caseCode={caseCode}
          type={type}
          options={options}
          initial={r.initial}
          meta={r.meta}
          hidden={{ extractionId: r.extractionId }}
          showAttach={false}
          attachNote={<p className="text-caption text-steel">{r.fileName} is attached to this document when you save.</p>}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="How to add it">
        <Button type="button" variant={mode === "read" ? "dark" : "secondary"} onClick={() => setMode("read")} aria-pressed={mode === "read"}>
          Read from a photo or PDF
        </Button>
        <Button type="button" variant={mode === "type" ? "dark" : "secondary"} onClick={() => setMode("type")} aria-pressed={mode === "type"}>
          Type it in
        </Button>
      </div>

      {mode === "read" ? (
        <Card>
          <SectionTitle
            title={`Read the ${label}`}
            description={
              canRead
                ? `Upload a photo or PDF. ${hasQr ? "A QR code on it is read first, exactly; the rest" : "It"} is read by Gemini, and you check every field before saving.`
                : "Upload a PDF or photo with its QR code visible. Only the QR code can be read here; type the rest in."
            }
          />
          <form onSubmit={read} className="space-y-4" noValidate>
            <Field label="Photo or PDF" htmlFor="read-file" hint="PDF, PNG or JPEG. Large photos are shrunk before upload.">
              <Input id="read-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="py-2.5" />
            </Field>
            {localError || state.error ? <p role="alert" className="text-body-sm text-error">{localError ?? state.error}</p> : null}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {pending || step ? <span className="text-body-sm text-steel" aria-live="polite">{pending ? step : null}</span> : null}
              <Button type="submit" disabled={pending}>{pending ? "Reading…" : "Read it"}</Button>
            </div>
          </form>
        </Card>
      ) : (
        <StructuredDocForm caseCode={caseCode} type={type} options={options} />
      )}
    </div>
  );
}
