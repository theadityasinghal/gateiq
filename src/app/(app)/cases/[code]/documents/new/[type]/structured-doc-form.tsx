"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { CircleCheck, CircleX, QrCode, ScanText, TriangleExclamationPoint } from "lucide-react";
import { cn } from "@/lib/cn";
import type { DocType } from "@/lib/documents";
import {
  DOC_FORMS,
  LOW_CONFIDENCE,
  blankRow,
  fillValues,
  type FieldMeta,
  type FieldSpec,
  type OptionSource,
  type StaticOption,
} from "@/lib/doc-forms";
import { hasContainerFormat, isValidContainerNo, suggestContainerNo } from "@/lib/iso6346";
import { submitDocument, type SubmissionFormState } from "@/server/cases/submissions";
import { AttachFile } from "./attach-file";

const GRID: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
};
const SPAN: Record<number, string> = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-3", 4: "sm:col-span-4" };

/**
 * The form for every structured document. Values live in client state and post as one JSON `payload`,
 * which the server validates with the type's zod schema. `initial` pre-fills it (a correction, or what was
 * read from a photo); `meta` marks where each pre-filled value came from.
 */
export function StructuredDocForm({
  caseCode,
  type,
  options,
  initial,
  meta,
  hidden,
  showAttach = true,
  attachNote,
  submitLabel,
}: {
  caseCode: string;
  type: DocType;
  options: Record<OptionSource, StaticOption[]>;
  initial?: Record<string, unknown> | null;
  meta?: Record<string, FieldMeta>;
  /** Extra hidden inputs, e.g. which document this corrects. */
  hidden?: Record<string, string>;
  showAttach?: boolean;
  attachNote?: React.ReactNode;
  submitLabel?: string;
}) {
  const spec = DOC_FORMS[type]!;
  const [state, action, pending] = useActionState<SubmissionFormState, FormData>(submitDocument.bind(null, caseCode, type), {});
  const start = fillValues(spec, initial);
  const [values, setValues] = useState(start.values);
  const [rows, setRows] = useState(start.rows);
  const err = (k: string) => state.fieldErrors?.[k];
  const today = new Date().toISOString().slice(0, 10);

  const setValue = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const setRow = (section: string, i: number, k: string, v: string) =>
    setRows((p) => ({ ...p, [section]: p[section].map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));

  const control = (f: FieldSpec, id: string, value: string, onChange: (v: string) => void) => {
    const invalid = !!err(id);
    const clean = (v: string) => (f.digitsOnly ? v.replace(/[^0-9]/g, "") : v);
    if (f.kind === "select") {
      const opts = typeof f.options === "string" ? options[f.options] : (f.options ?? []);
      return (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid}>
          {f.defaultValue ? null : <option value="">Select…</option>}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      );
    }
    if (f.kind === "date") {
      return <Input id={id} type="date" max={f.noFuture ? today : undefined} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} />;
    }
    const mono = f.kind === "code" || f.kind === "container";
    return (
      <Input
        id={id}
        value={value}
        maxLength={f.kind === "container" ? 15 : f.maxLength}
        placeholder={f.placeholder ?? (f.kind === "container" ? "MSKU 123456 5" : undefined)}
        inputMode={f.kind === "number" ? "decimal" : f.kind === "integer" || f.digitsOnly ? "numeric" : undefined}
        onChange={(e) => onChange(clean(e.target.value))}
        className={cn(mono && "font-mono uppercase")}
        aria-invalid={invalid}
      />
    );
  };

  const field = (f: FieldSpec, id: string, value: string, onChange: (v: string) => void) => {
    const m = meta?.[id];
    return (
      <Field
        key={id}
        label={f.label}
        htmlFor={id}
        error={err(id)}
        hint={f.kind === "container" ? <ContainerHint value={value} /> : m?.problem ?? f.hint}
        aside={<MetaTag m={m} />}
        className={cn(SPAN[f.span ?? 1], m && needsLook(m) && "rounded-md ring-1 ring-tag-orange-fg/40 ring-offset-4 ring-offset-canvas")}
      >
        {control(f, id, value, onChange)}
      </Field>
    );
  };

  return (
    <form action={action} className="mt-8 space-y-6" noValidate>
      <input type="hidden" name="payload" value={JSON.stringify({ ...values, ...rows })} />
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      {spec.sections.map((s) =>
        s.kind === "group" ? (
          <Card key={s.title}>
            <SectionTitle title={s.title} description={s.description} />
            <div className={cn("grid gap-5", GRID[s.cols])}>
              {s.fields.map((f) => field(f, f.key, values[f.key] ?? "", (v) => setValue(f.key, v)))}
            </div>
          </Card>
        ) : (
          <Card key={s.key}>
            <SectionTitle title={s.title} description={s.description} />
            {err(s.key) ? <p role="alert" className="mb-4 text-caption text-error">{err(s.key)}</p> : null}
            <div className="space-y-4">
              {rows[s.key].map((r, i) => (
                <div key={i} className="rounded-lg border border-hairline-soft bg-surface-soft p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-micro-upper text-steel">{s.itemLabel} {i + 1}</span>
                    {rows[s.key].length > s.min ? (
                      <Button type="button" variant="ghost" onClick={() => setRows((p) => ({ ...p, [s.key]: p[s.key].filter((_, j) => j !== i) }))}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <div className={cn("grid gap-4", GRID[s.cols])}>
                    {s.fields.map((f) => field(f, `${s.key}.${i}.${f.key}`, r[f.key] ?? "", (v) => setRow(s.key, i, f.key, v)))}
                  </div>
                </div>
              ))}
            </div>
            {rows[s.key].length < s.max ? (
              <Button type="button" variant="secondary" className="mt-4" onClick={() => setRows((p) => ({ ...p, [s.key]: [...p[s.key], blankRow(s)] }))}>
                {s.addLabel}
              </Button>
            ) : null}
          </Card>
        ),
      )}

      {showAttach ? <AttachFile error={err("file")} /> : attachNote ?? null}

      {state.error || state.fieldErrors ? (
        <p role="alert" className="text-body-sm text-error">{state.error ?? "Some fields need attention. They are marked above."}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel ?? spec.submitLabel}</Button>
      </div>
    </form>
  );
}

function needsLook(m: FieldMeta) {
  return !!m.problem || (m.source === "model" && (m.confidence ?? 0) < LOW_CONFIDENCE);
}

/** Where a pre-filled value came from, as one icon beside the label; the details are in the tooltip. */
function MetaTag({ m }: { m?: FieldMeta }) {
  if (!m) return null;
  const [Icon, color, title] =
    m.source === "qr"
      ? [QrCode, "text-tag-sky-fg", "From the QR code: exact"]
      : needsLook(m)
        ? [TriangleExclamationPoint, "text-tag-orange-fg", [m.problem ?? "Uncertain reading: compare with the paper", m.asWritten ? `Read as: ${m.asWritten}` : ""].filter(Boolean).join(" · ")]
        : [ScanText, "text-stone", m.asWritten ? `Read from the file as: ${m.asWritten}` : "Read from the file"];
  return (
    <span title={title} className={color}>
      <Icon size={15} strokeWidth={1.8} aria-label={title} role="img" />
    </span>
  );
}

/** Live ISO 6346 check while typing. A failing number can still be saved: it is what the paper says. */
function ContainerHint({ value }: { value: string }) {
  if (!value.trim() || !hasContainerFormat(value)) return <>4 letters, 7 digits</>;
  if (isValidContainerNo(value)) {
    return (
      <span className="inline-flex items-center gap-1 text-tag-green-fg">
        <CircleCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Check digit OK
      </span>
    );
  }
  const s = suggestContainerNo(value);
  return (
    <span
      className="inline-flex items-start gap-1 text-tag-orange-fg"
      title={`${s.length ? `One slip away: ${s.join(", ")}. ` : ""}Keep it if the paper really says this: the checks will flag it.`}
    >
      <CircleX size={14} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>Check digit fails{s.length ? <> · <span className="font-mono">{s[0]}</span>?</> : null}</span>
    </span>
  );
}
