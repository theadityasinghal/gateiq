"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import type { PhoneCountry } from "@/lib/phone";
import { addLorryReceipt, type SubmissionFormState } from "@/server/cases/submissions";
import { AttachFile } from "./attach-file";

export function LorryReceiptForm({ caseCode, countries }: { caseCode: string; countries: PhoneCountry[] }) {
  const [state, action, pending] = useActionState<SubmissionFormState, FormData>(addLorryReceipt.bind(null, caseCode), {});
  const [f, setF] = useState({
    lrNumber: "",
    lrDate: "",
    vehicleNumber: "",
    driverName: "",
    driverPhoneCountry: "IN",
    driverPhone: "",
    fromPlace: "",
    toPlace: "",
    packages: "",
    goodsDescription: "",
    chargedWeight: "",
    weightUnit: "KGS",
  });
  const err = (k: string) => state.fieldErrors?.[k];
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="mt-8 space-y-6" noValidate>
      <input type="hidden" name="payload" value={JSON.stringify(f)} />

      <Card>
        <SectionTitle title="Lorry receipt" />
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="LR number" htmlFor="lrNumber" error={err("lrNumber")}>
            <Input id="lrNumber" value={f.lrNumber} maxLength={30} onChange={set("lrNumber")} className="font-mono uppercase" />
          </Field>
          <Field label="LR date" htmlFor="lrDate" error={err("lrDate")}>
            <Input id="lrDate" type="date" max={today} value={f.lrDate} onChange={set("lrDate")} />
          </Field>
          <Field label="Vehicle number" htmlFor="vehicleNumber" error={err("vehicleNumber")}>
            <Input id="vehicleNumber" value={f.vehicleNumber} maxLength={13} placeholder="MH04AB1234" onChange={set("vehicleNumber")} className="font-mono uppercase" />
          </Field>
          <Field label="From" htmlFor="fromPlace" error={err("fromPlace")}>
            <Input id="fromPlace" value={f.fromPlace} onChange={set("fromPlace")} />
          </Field>
          <Field label="To" htmlFor="toPlace" error={err("toPlace")}>
            <Input id="toPlace" value={f.toPlace} onChange={set("toPlace")} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Driver" description="If known. It helps the gate match the truck and driver to this case." />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Driver name" htmlFor="driverName" error={err("driverName")}>
            <Input id="driverName" value={f.driverName} onChange={set("driverName")} />
          </Field>
          <Field label="Driver mobile" htmlFor="driverPhone" error={err("driverPhone")}>
            <div className="flex gap-2">
              <div className="w-[136px] shrink-0">
                <Select aria-label="Country code" value={f.driverPhoneCountry} onChange={set("driverPhoneCountry")} className="truncate">
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} +{c.dial}  {c.name}</option>
                  ))}
                </Select>
              </div>
              <Input id="driverPhone" type="tel" inputMode="tel" className="min-w-0 flex-1" value={f.driverPhone} onChange={set("driverPhone")} aria-invalid={!!err("driverPhone")} />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Goods" description="As written on the LR." />
        <div className="grid gap-5 sm:grid-cols-4">
          <Field label="Description of goods" htmlFor="goodsDescription" error={err("goodsDescription")} className="sm:col-span-4">
            <Input id="goodsDescription" value={f.goodsDescription} onChange={set("goodsDescription")} />
          </Field>
          <Field label="Packages" htmlFor="packages" error={err("packages")}>
            <Input id="packages" value={f.packages} inputMode="numeric" onChange={set("packages")} />
          </Field>
          <Field label="Charged weight" htmlFor="chargedWeight" error={err("chargedWeight")}>
            <Input id="chargedWeight" value={f.chargedWeight} inputMode="decimal" onChange={set("chargedWeight")} />
          </Field>
          <Field label="Unit" htmlFor="weightUnit" error={err("weightUnit")}>
            <Select id="weightUnit" value={f.weightUnit} onChange={set("weightUnit")}>
              <option value="KGS">kg</option>
              <option value="MTS">tonnes</option>
            </Select>
          </Field>
        </div>
      </Card>

      <AttachFile error={err("file")} />

      {state.error || state.fieldErrors ? (
        <p role="alert" className="text-body-sm text-error">{state.error ?? "Some fields need attention. They are marked above."}</p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add lorry receipt"}</Button>
      </div>
    </form>
  );
}
