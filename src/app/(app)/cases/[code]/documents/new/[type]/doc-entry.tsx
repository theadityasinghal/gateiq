"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { FileUp, Keyboard, QrCode, ScanText, TriangleExclamationPoint } from "lucide-react";
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
    const readCount = Object.values(r.meta).filter((m) => m.source === "model").length - toCheck;
    return (
      <div className="mt-8 space-y-6">
        <Card>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-h5">Check what was read</h2>
            {r.usedQr ? (
              <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-tag-sky-fg" title={`${fromQr} fields from the QR code (exact; its signature isn't verified)${Object.keys(r.qrExtras).length ? `. Also in it: ${Object.entries(r.qrExtras).map(([k, v]) => `${k} ${v}`).join(", ")}` : ""}`}>
                <QrCode size={16} strokeWidth={1.8} aria-label="From the QR code" role="img" />
                {fromQr}
              </span>
            ) : null}
            {r.usedModel ? (
              <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-stone" title="Read by Gemini">
                <ScanText size={16} strokeWidth={1.8} aria-label="Read by Gemini" role="img" />
                {readCount}
              </span>
            ) : null}
            {toCheck ? (
              <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-tag-orange-fg" title="Uncertain or failing a check: compare with the paper">
                <TriangleExclamationPoint size={16} strokeWidth={1.8} aria-label="To check" role="img" />
                {toCheck}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-body-sm text-slate">Nothing is saved until you confirm the form below.</p>
          {r.warning ? <p role="alert" className="mt-3 rounded-md bg-tint-peach p-3 text-body-sm text-tag-orange-fg">{r.warning}</p> : null}
          {preview ? (
            preview.isPdf ? (
              <a href={preview.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-link-blue">
                <FileUp size={15} strokeWidth={1.8} aria-hidden="true" /> {r.fileName}
              </a>
            ) : (
              <a href={preview.url} target="_blank" rel="noreferrer" className="mt-4 block" title="Open full size">
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
          attachNote={null}
        />
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="inline-flex rounded-md border border-hairline-strong p-1" role="group" aria-label="How to add it">
        {(
          [
            ["read", ScanText, "From a file"],
            ["type", Keyboard, "Type it"],
          ] as const
        ).map(([m, Icon, text]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`inline-flex min-h-9 items-center gap-2 rounded-sm px-3 text-[14px] font-medium ${mode === m ? "bg-ink-deep text-canvas" : "text-slate"}`}
          >
            <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
            {text}
          </button>
        ))}
      </div>

      {mode === "read" ? (
        <Card>
          <SectionTitle
            title={`Read the ${label}`}
            description={
              canRead
                ? `${hasQr ? "QR code first, then Gemini. " : ""}You confirm every field before it's saved.`
                : "Only the QR code can be read here; type the rest."
            }
          />
          <form onSubmit={read} className="space-y-4" noValidate>
            <Field label="Photo or PDF" htmlFor="read-file" hint="PDF, PNG or JPEG">
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
