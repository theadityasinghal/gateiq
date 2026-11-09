"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { addEwayBill, type SubmissionFormState } from "@/server/cases/submissions";
import { EWB_DOC_TYPES, EWB_DOC_TYPE_LABEL, EWB_TRANSPORT_MODES } from "@/lib/case-schema";
import { AttachFile } from "./attach-file";

type Option = { code: string; name: string };
type Line = { description: string; hsCode: string; quantity: string; uqc: string; value: string };
const emptyLine = (): Line => ({ description: "", hsCode: "", quantity: "", uqc: "", value: "" });
const MODE_LABEL: Record<(typeof EWB_TRANSPORT_MODES)[number], string> = { ROAD: "Road", RAIL: "Rail", AIR: "Air", SHIP: "Ship" };

export function EwayBillForm({
  caseCode,
  units,
}: {
  caseCode: string;
  units: Option[];
}) {
  const [state, action, pending] = useActionState<SubmissionFormState, FormData>(addEwayBill.bind(null, caseCode), {});
  const [f, setF] = useState({
    ewbNumber: "",
    ewbDate: "",
    validUntil: "",
    fromGstin: "",
    fromPincode: "",
    toGstin: "URP",
    toPincode: "",
    docType: "INV",
    docNumber: "",
    docDate: "",
    transportMode: "ROAD",
    distanceKm: "",
    transporterId: "",
    vehicleNumber: "",
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
        <SectionTitle title="E-way bill" />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="E-way bill number" htmlFor="ewbNumber" error={err("ewbNumber")}>
            <Input id="ewbNumber" value={f.ewbNumber} inputMode="numeric" maxLength={14} onChange={set("ewbNumber")} className="font-mono" />
          </Field>
          <Field label="Generated on" htmlFor="ewbDate" error={err("ewbDate")}>
            <Input id="ewbDate" type="date" max={today} value={f.ewbDate} onChange={set("ewbDate")} />
          </Field>
          <Field label="Valid until (if shown)" htmlFor="validUntil" error={err("validUntil")}>
            <Input id="validUntil" type="date" min={f.ewbDate || undefined} value={f.validUntil} onChange={set("validUntil")} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Part A: supply" description="Who ships, who receives, and the document the goods move on." />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="From GSTIN (supplier)" htmlFor="fromGstin" error={err("fromGstin")}>
            <Input id="fromGstin" value={f.fromGstin} maxLength={15} onChange={set("fromGstin")} className="font-mono uppercase" />
          </Field>
          <Field label="Dispatch PIN code" htmlFor="fromPincode" error={err("fromPincode")}>
            <Input id="fromPincode" value={f.fromPincode} inputMode="numeric" maxLength={6} onChange={set("fromPincode")} className="font-mono" />
          </Field>
          <Field label="To GSTIN" htmlFor="toGstin" error={err("toGstin")} hint="URP for an unregistered or overseas recipient, as on most export e-way bills.">
            <Input id="toGstin" value={f.toGstin} maxLength={15} onChange={set("toGstin")} className="font-mono uppercase" />
          </Field>
          <Field label="Delivery PIN code" htmlFor="toPincode" error={err("toPincode")} hint="For exports, usually the port or ICD.">
            <Input id="toPincode" value={f.toPincode} inputMode="numeric" maxLength={6} onChange={set("toPincode")} className="font-mono" />
          </Field>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Field label="Document type" htmlFor="docType" error={err("docType")}>
            <Select id="docType" value={f.docType} onChange={set("docType")}>
              {EWB_DOC_TYPES.map((t) => <option key={t} value={t}>{EWB_DOC_TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="Document number" htmlFor="docNumber" error={err("docNumber")}>
            <Input id="docNumber" value={f.docNumber} maxLength={16} onChange={set("docNumber")} className="font-mono uppercase" />
          </Field>
          <Field label="Document date" htmlFor="docDate" error={err("docDate")}>
            <Input id="docDate" type="date" max={f.ewbDate || today} value={f.docDate} onChange={set("docDate")} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Items" description="As listed on the e-way bill. Values are taxable values in INR." />
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
                  <Field label="Product name" htmlFor={id("description")} error={err(id("description"))} className="sm:col-span-2">
                    <Input id={id("description")} value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} />
                  </Field>
                  <Field label="HSN" htmlFor={id("hsCode")} error={err(id("hsCode"))}>
                    <Input id={id("hsCode")} value={l.hsCode} inputMode="numeric" maxLength={8} onChange={(e) => setLine(i, "hsCode", e.target.value.replace(/[^0-9]/g, ""))} className="font-mono" />
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
                  <Field label="Taxable value (INR)" htmlFor={id("value")} error={err(id("value"))}>
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

      <Card>
        <SectionTitle title="Part B: transport" description="Leave the vehicle number empty if the truck isn't assigned yet. Add the updated e-way bill once it is." />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Mode" htmlFor="transportMode" error={err("transportMode")}>
            <Select id="transportMode" value={f.transportMode} onChange={set("transportMode")}>
              {EWB_TRANSPORT_MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
            </Select>
          </Field>
          <Field label="Approx. distance (km)" htmlFor="distanceKm" error={err("distanceKm")}>
            <Input id="distanceKm" value={f.distanceKm} inputMode="numeric" onChange={set("distanceKm")} />
          </Field>
          <Field label="Transporter ID (if shown)" htmlFor="transporterId" error={err("transporterId")}>
            <Input id="transporterId" value={f.transporterId} maxLength={15} onChange={set("transporterId")} className="font-mono uppercase" />
          </Field>
          <Field label="Vehicle number (if assigned)" htmlFor="vehicleNumber" error={err("vehicleNumber")}>
            <Input id="vehicleNumber" value={f.vehicleNumber} maxLength={13} placeholder="MH04AB1234" onChange={set("vehicleNumber")} className="font-mono uppercase" />
          </Field>
        </div>
      </Card>

      <AttachFile error={err("file")} />

      {state.error || state.fieldErrors ? (
        <p role="alert" className="text-body-sm text-error">{state.error ?? "Some fields need attention. They are marked above."}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add e-way bill"}</Button>
      </div>
    </form>
  );
}
