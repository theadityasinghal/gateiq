"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { addShippingBill, type SubmissionFormState } from "@/server/cases/submissions";
import { AttachFile } from "./attach-file";

type Option = { code: string; name: string };
type Line = { description: string; hsCode: string; quantity: string; uqc: string; value: string };
const emptyLine = (): Line => ({ description: "", hsCode: "", quantity: "", uqc: "", value: "" });

export function ShippingBillForm({
  caseCode,
  currencies,
  units,
  massUnits,
}: {
  caseCode: string;
  currencies: Option[];
  units: Option[];
  massUnits: Option[];
}) {
  const [state, action, pending] = useActionState<SubmissionFormState, FormData>(addShippingBill.bind(null, caseCode), {});
  const massDefault = massUnits.find((u) => u.code === "KGS")?.code ?? "";
  const [f, setF] = useState({
    sbNumber: "",
    sbDate: "",
    portCode: "",
    exporterIec: "",
    exporterGstin: "",
    consigneeName: "",
    currency: "",
    totalPackages: "",
    grossWeight: "",
    netWeight: "",
    weightUnit: massDefault,
  });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const err = (k: string) => state.fieldErrors?.[k];
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setLine = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="mt-8 space-y-6" noValidate>
      <input type="hidden" name="payload" value={JSON.stringify({ ...f, lines })} />

      <Card>
        <SectionTitle title="Shipping bill" />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="SB number" htmlFor="sbNumber" error={err("sbNumber")}>
            <Input id="sbNumber" value={f.sbNumber} inputMode="numeric" onChange={set("sbNumber")} className="font-mono" />
          </Field>
          <Field label="SB date" htmlFor="sbDate" error={err("sbDate")}>
            <Input id="sbDate" type="date" max={today} value={f.sbDate} onChange={set("sbDate")} />
          </Field>
          <Field label="Port code" htmlFor="portCode" error={err("portCode")}>
            <Input id="portCode" value={f.portCode} maxLength={6} onChange={set("portCode")} className="font-mono uppercase" />
          </Field>
          <Field label="Exporter IEC" htmlFor="exporterIec" error={err("exporterIec")}>
            <Input id="exporterIec" value={f.exporterIec} maxLength={10} onChange={set("exporterIec")} className="font-mono uppercase" />
          </Field>
          <Field label="Exporter GSTIN (if shown)" htmlFor="exporterGstin" error={err("exporterGstin")}>
            <Input id="exporterGstin" value={f.exporterGstin} maxLength={15} onChange={set("exporterGstin")} className="font-mono uppercase" />
          </Field>
          <Field label="Currency" htmlFor="currency" error={err("currency")}>
            <Select id="currency" value={f.currency} onChange={set("currency")}>
              <option value="">Select…</option>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </Select>
          </Field>
          <Field label="Consignee name" htmlFor="consigneeName" error={err("consigneeName")} className="sm:col-span-3">
            <Input id="consigneeName" value={f.consigneeName} onChange={set("consigneeName")} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Packages and weight" description="The totals printed on the shipping bill." />
        <div className="grid gap-5 sm:grid-cols-4">
          <Field label="Total packages" htmlFor="totalPackages" error={err("totalPackages")}>
            <Input id="totalPackages" value={f.totalPackages} inputMode="numeric" onChange={set("totalPackages")} />
          </Field>
          <Field label="Gross weight" htmlFor="grossWeight" error={err("grossWeight")}>
            <Input id="grossWeight" value={f.grossWeight} inputMode="decimal" onChange={set("grossWeight")} />
          </Field>
          <Field label="Net weight" htmlFor="netWeight" error={err("netWeight")}>
            <Input id="netWeight" value={f.netWeight} inputMode="decimal" onChange={set("netWeight")} />
          </Field>
          <Field label="Weight unit" htmlFor="weightUnit" error={err("weightUnit")}>
            <Select id="weightUnit" value={f.weightUnit} onChange={set("weightUnit")}>
              <option value="">Select…</option>
              {massUnits.map((u) => <option key={u.code} value={u.code}>{u.code} · {u.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Item lines" />
        {err("lines") ? <p role="alert" className="mb-4 text-caption text-error">{err("lines")}</p> : null}
        <div className="space-y-4">
          {lines.map((l, i) => {
            const id = (k: string) => `lines.${i}.${k}`;
            return (
              <div key={i} className="rounded-lg border border-hairline-soft bg-surface-soft p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-micro-upper text-steel">Item {i + 1}</span>
                  {lines.length > 1 ? (
                    <Button type="button" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</Button>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Description" htmlFor={id("description")} error={err(id("description"))} className="sm:col-span-2">
                    <Input id={id("description")} value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} />
                  </Field>
                  <Field label="HS code" htmlFor={id("hsCode")} error={err(id("hsCode"))}>
                    <Input id={id("hsCode")} value={l.hsCode} inputMode="numeric" maxLength={10} onChange={(e) => setLine(i, "hsCode", e.target.value.replace(/[^0-9]/g, ""))} className="font-mono" />
                  </Field>
                  <Field label="Quantity" htmlFor={id("quantity")} error={err(id("quantity"))}>
                    <Input id={id("quantity")} value={l.quantity} inputMode="decimal" onChange={(e) => setLine(i, "quantity", e.target.value)} />
                  </Field>
                  <Field label="Unit (UQC)" htmlFor={id("uqc")} error={err(id("uqc"))}>
                    <Select id={id("uqc")} value={l.uqc} onChange={(e) => setLine(i, "uqc", e.target.value)}>
                      <option value="">Select…</option>
                      {units.map((u) => <option key={u.code} value={u.code}>{u.code} · {u.name}</option>)}
                    </Select>
                  </Field>
                  <Field label={`FOB value${f.currency ? ` (${f.currency})` : ""}`} htmlFor={id("value")} error={err(id("value"))}>
                    <Input id={id("value")} value={l.value} inputMode="decimal" onChange={(e) => setLine(i, "value", e.target.value)} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
          Add item
        </Button>
      </Card>

      <AttachFile error={err("file")} />

      {state.error || state.fieldErrors ? (
        <p role="alert" className="text-body-sm text-error">{state.error ?? "Some fields need attention. They are marked above."}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add shipping bill"}</Button>
      </div>
    </form>
  );
}
