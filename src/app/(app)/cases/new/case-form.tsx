"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { createCase, type CaseFormState } from "@/server/cases/actions";
import { INCOTERMS_2020, PERISHABLE_CERTIFICATES } from "@/lib/incoterms";

type Option = { code: string; name: string };

type Line = {
  description: string;
  hsCode: string;
  quantity: string;
  uqc: string;
  netWeight: string;
  grossWeight: string;
  weightUnit: string;
  packages: string;
  packageType: string;
  value: string;
};

const emptyLine = (massUnit: string): Line => ({
  description: "",
  hsCode: "",
  quantity: "",
  uqc: "",
  netWeight: "",
  grossWeight: "",
  weightUnit: massUnit,
  packages: "",
  packageType: "",
  value: "",
});

export function CaseForm({
  countries,
  currencies,
  units,
  massUnits,
}: {
  countries: Option[];
  currencies: Option[];
  units: Option[];
  massUnits: Option[];
}) {
  const [state, action, pending] = useActionState<CaseFormState, FormData>(createCase, {});
  const defaultMass = massUnits.find((u) => u.code === "KGS")?.code ?? massUnits[0]?.code ?? "";

  const [f, setF] = useState({
    originPlace: "",
    exportPortCode: "",
    destinationCountry: "",
    destinationPort: "",
    incoterm: "",
    currency: "",
  });
  const [lines, setLines] = useState<Line[]>([emptyLine(defaultMass)]);
  const [hazmatOn, setHazmatOn] = useState(false);
  const [hazmat, setHazmat] = useState({ unNumber: "", hazardClass: "" });
  const [pharmaOn, setPharmaOn] = useState(false);
  const [pharma, setPharma] = useState({ minC: "", maxC: "" });
  const [perishableOn, setPerishableOn] = useState(false);
  const [perishable, setPerishable] = useState({ certificateType: "" });

  const err = (k: string) => state.fieldErrors?.[k];
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const setLine = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const payload = JSON.stringify({
    ...f,
    lines,
    hazmat: hazmatOn ? hazmat : null,
    pharma: pharmaOn ? pharma : null,
    perishable: perishableOn ? perishable : null,
  });

  return (
    <form action={action} className="mt-8 space-y-6" noValidate>
      <input type="hidden" name="payload" value={payload} />

      <Card>
        <SectionTitle title="Route and terms" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Origin (place of dispatch)" htmlFor="originPlace" error={err("originPlace")}>
            <Input id="originPlace" value={f.originPlace} onChange={set("originPlace")} placeholder="Factory or warehouse, city" />
          </Field>
          <Field label="Port / ICD of export" htmlFor="exportPortCode" error={err("exportPortCode")} hint="6-character customs location code">
            <Input id="exportPortCode" value={f.exportPortCode} onChange={set("exportPortCode")} maxLength={6} className="font-mono uppercase" />
          </Field>
          <Field label="Destination country" htmlFor="destinationCountry" error={err("destinationCountry")}>
            <Select id="destinationCountry" value={f.destinationCountry} onChange={set("destinationCountry")}>
              <option value="">Select…</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Destination port (optional)" htmlFor="destinationPort" error={err("destinationPort")}>
            <Input id="destinationPort" value={f.destinationPort} onChange={set("destinationPort")} />
          </Field>
          <Field label="Incoterm" htmlFor="incoterm" error={err("incoterm")}>
            <Select id="incoterm" value={f.incoterm} onChange={set("incoterm")}>
              <option value="">Select…</option>
              {INCOTERMS_2020.map((i) => <option key={i.code} value={i.code}>{i.code} · {i.name}</option>)}
            </Select>
          </Field>
          <Field label="Invoice currency" htmlFor="currency" error={err("currency")}>
            <Select id="currency" value={f.currency} onChange={set("currency")}>
              <option value="">Select…</option>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Goods" description="One line per product, as on your commercial invoice and packing list." />
        {err("lines") ? <p role="alert" className="mb-4 text-caption text-error">{err("lines")}</p> : null}
        <div className="space-y-4">
          {lines.map((l, i) => {
            const id = (k: string) => `lines.${i}.${k}`;
            return (
              <div key={i} className="rounded-lg border border-hairline-soft bg-surface-soft p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-micro-upper text-steel">Line {i + 1}</span>
                  {lines.length > 1 ? (
                    <Button type="button" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</Button>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Description" htmlFor={id("description")} error={err(id("description"))} className="sm:col-span-2 lg:col-span-3">
                    <Input id={id("description")} value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} />
                  </Field>
                  <Field label="HS code (8-digit)" htmlFor={id("hsCode")} error={err(id("hsCode"))}>
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
                  <Field label="Packages" htmlFor={id("packages")} error={err(id("packages"))}>
                    <Input id={id("packages")} value={l.packages} inputMode="numeric" onChange={(e) => setLine(i, "packages", e.target.value)} />
                  </Field>
                  <Field label="Package type" htmlFor={id("packageType")} error={err(id("packageType"))}>
                    <Input id={id("packageType")} value={l.packageType} onChange={(e) => setLine(i, "packageType", e.target.value)} placeholder="Cartons, bags, drums…" />
                  </Field>
                  <Field label="Net weight" htmlFor={id("netWeight")} error={err(id("netWeight"))}>
                    <Input id={id("netWeight")} value={l.netWeight} inputMode="decimal" onChange={(e) => setLine(i, "netWeight", e.target.value)} />
                  </Field>
                  <Field label="Gross weight" htmlFor={id("grossWeight")} error={err(id("grossWeight"))}>
                    <Input id={id("grossWeight")} value={l.grossWeight} inputMode="decimal" onChange={(e) => setLine(i, "grossWeight", e.target.value)} />
                  </Field>
                  <Field label="Weight unit" htmlFor={id("weightUnit")} error={err(id("weightUnit"))}>
                    <Select id={id("weightUnit")} value={l.weightUnit} onChange={(e) => setLine(i, "weightUnit", e.target.value)}>
                      <option value="">Select…</option>
                      {massUnits.map((u) => <option key={u.code} value={u.code}>{u.code} · {u.name}</option>)}
                    </Select>
                  </Field>
                  <Field label={`Value${f.currency ? ` (${f.currency})` : ""}`} htmlFor={id("value")} error={err(id("value"))}>
                    <Input id={id("value")} value={l.value} inputMode="decimal" onChange={(e) => setLine(i, "value", e.target.value)} />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => setLines((ls) => [...ls, emptyLine(defaultMass)])}>
          Add line
        </Button>
      </Card>

      <Card>
        <SectionTitle title="Special cargo" description="Tick any that apply. Each adds the papers that kind of cargo needs." />
        <div className="space-y-5">
          <Toggle id="hazmat" label="Hazardous goods" checked={hazmatOn} onChange={setHazmatOn} />
          {hazmatOn ? (
            <div className="grid gap-4 pl-8 sm:grid-cols-3">
              <Field label="UN number" htmlFor="hazmat.unNumber" error={err("hazmat.unNumber")}>
                <Input id="hazmat.unNumber" value={hazmat.unNumber} onChange={(e) => setHazmat((h) => ({ ...h, unNumber: e.target.value }))} placeholder="UN1234" className="uppercase" />
              </Field>
              <Field label="Hazard class" htmlFor="hazmat.hazardClass" error={err("hazmat.hazardClass")}>
                <Input id="hazmat.hazardClass" value={hazmat.hazardClass} onChange={(e) => setHazmat((h) => ({ ...h, hazardClass: e.target.value }))} placeholder="e.g. 3 or 2.1" />
              </Field>
              <Field label="MSDS" htmlFor="msds" error={err("hazmat.msds")} hint="PDF, PNG or JPEG">
                <input id="msds" name="msds" type="file" accept="application/pdf,image/png,image/jpeg" className="text-body-sm file:mr-3 file:rounded-md file:border file:border-hairline-strong file:bg-canvas file:px-3 file:py-2 file:text-[14px]" />
              </Field>
            </div>
          ) : null}

          <Toggle id="pharma" label="Temperature-controlled (pharma)" checked={pharmaOn} onChange={setPharmaOn} />
          {pharmaOn ? (
            <div className="grid gap-4 pl-8 sm:grid-cols-3">
              <Field label="Minimum °C" htmlFor="pharma.minC" error={err("pharma.minC")}>
                <Input id="pharma.minC" value={pharma.minC} inputMode="decimal" onChange={(e) => setPharma((p) => ({ ...p, minC: e.target.value }))} />
              </Field>
              <Field label="Maximum °C" htmlFor="pharma.maxC" error={err("pharma.maxC")}>
                <Input id="pharma.maxC" value={pharma.maxC} inputMode="decimal" onChange={(e) => setPharma((p) => ({ ...p, maxC: e.target.value }))} />
              </Field>
            </div>
          ) : null}

          <Toggle id="perishable" label="Perishable" checked={perishableOn} onChange={setPerishableOn} />
          {perishableOn ? (
            <div className="grid gap-4 pl-8 sm:grid-cols-2">
              <Field label="Certificate type" htmlFor="perishable.certificateType" error={err("perishable.certificateType")}>
                <Select id="perishable.certificateType" value={perishable.certificateType} onChange={(e) => setPerishable({ certificateType: e.target.value })}>
                  <option value="">Select…</option>
                  {PERISHABLE_CERTIFICATES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Certificate (optional)" htmlFor="certificate" error={err("perishable.certificate")} hint="PDF, PNG or JPEG">
                <input id="certificate" name="certificate" type="file" accept="application/pdf,image/png,image/jpeg" className="text-body-sm file:mr-3 file:rounded-md file:border file:border-hairline-strong file:bg-canvas file:px-3 file:py-2 file:text-[14px]" />
              </Field>
            </div>
          ) : null}
        </div>
      </Card>

      {state.error || state.fieldErrors ? (
        <p role="alert" className="text-body-sm text-error">
          {state.error ?? "Some fields need attention. They are marked above."}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creating case…" : "Create case"}</Button>
      </div>
    </form>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-primary" />
      <span className="text-[16px] font-medium text-charcoal">{label}</span>
    </label>
  );
}
