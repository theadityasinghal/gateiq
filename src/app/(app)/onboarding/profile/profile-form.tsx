"use client";

import { useActionState } from "react";
import { ROLE_INFO, type Role } from "@/lib/roles";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LEVEL_EXPLAINER, VerificationBadge } from "@/components/ui/verification-badge";
import { saveProfile, type FormState } from "@/server/onboarding/actions";
import type { VerificationLevel } from "@/lib/verify/types";
import type { PhoneCountry } from "@/lib/phone";
import { PhoneInput } from "@/components/phone-input";
import { Info } from "lucide-react";

type Values = Record<"legalName" | "organisation" | "address" | "phone" | "phoneCountry" | "iec" | "gstin" | "idValue", string>;
type Check = { level: VerificationLevel; message: string };

export function ProfileForm({
  role,
  email,
  initial,
  checks,
  countries,
  returnTo,
}: {
  role: Role;
  email: string;
  initial: Values;
  checks: Record<string, Check>;
  countries: PhoneCountry[];
  returnTo: "dashboard" | "profile";
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfile, {});
  const info = ROLE_INFO[role];
  const v = (k: keyof Values) => state.values?.[k] ?? initial[k];
  const err = (k: string) => state.fieldErrors?.[k];
  const badge = (k: string) =>
    checks[k] ? <VerificationBadge level={checks[k].level} message={checks[k].message} /> : null;
  const hint = (k: string, fallback: string) => (checks[k]?.message ? checks[k].message : fallback);

  return (
    <form action={action} className="mt-8 space-y-6" noValidate>
      <input type="hidden" name="returnTo" value={returnTo} />
      <Card className="space-y-5">
        <Field label="Email" htmlFor="email" aside={badge("email") ?? <VerificationBadge level="self_declared" />} hint="The email you signed up with.">
          <Input id="email" value={email} disabled readOnly />
        </Field>
        <Field label="Full legal name" htmlFor="legalName" error={err("legalName")} aside={badge("legalName")}
          hint={role === "consignor" ? "As registered with GST and DGFT." : role === "consignee" ? "As it should appear on the shipping bill." : "As on your official ID."}>
          <Input id="legalName" name="legalName" defaultValue={v("legalName")} autoComplete="name" required />
        </Field>
        <Field label="Mobile number" htmlFor="phone" error={err("phone")} aside={badge("phone")}
          hint={hint("phone", "Choose the country code, then type the number.")}>
          {/* key: remount after a failed submit so the echoed values show. */}
          <PhoneInput key={`${v("phoneCountry")}:${v("phone")}`} countries={countries} defaultCountry={v("phoneCountry")}
            defaultValue={v("phone")} invalid={!!err("phone")} />
        </Field>
        {role !== "consignor" ? (
          <Field label={role === "consignee" ? "Company name (optional)" : "Organisation (optional)"} htmlFor="organisation"
            error={err("organisation")} aside={badge("organisation")}
            hint={role === "consignee" ? "The buyer name exporters put on the shipping bill. GateIQ compares the two." : undefined}>
            <Input id="organisation" name="organisation" defaultValue={v("organisation")} autoComplete="organization" />
          </Field>
        ) : null}
        {role === "consignee" ? (
          <Field label="Address (optional)" htmlFor="address" error={err("address")} aside={badge("address")}>
            <Textarea id="address" name="address" defaultValue={v("address")} autoComplete="street-address" />
          </Field>
        ) : null}
      </Card>

      {role === "consignor" ? (
        <Card className="space-y-5">
          <div>
            <h2 className="text-h5">Business identifiers (optional)</h2>
            <p className="text-body-sm text-slate">
              You can add these later. Checked for format and checksum now; confirming them with the GST and DGFT registries comes later.
            </p>
          </div>
          <Field label="GSTIN" htmlFor="gstin" error={err("gstin")} aside={badge("gstin")}
            hint={hint("gstin", "15 characters. The last one is a check digit, so typos are caught.")}>
            <Input id="gstin" name="gstin" defaultValue={v("gstin")} maxLength={15} autoCapitalize="characters" className="font-mono uppercase" />
          </Field>
          <Field label="IEC (Importer Exporter Code)" htmlFor="iec" error={err("iec")} aside={badge("iec")}
            hint={hint("iec", "Your IEC is your PAN. It must match characters 3 to 12 of your GSTIN.")}>
            <Input id="iec" name="iec" defaultValue={v("iec")} maxLength={10} autoCapitalize="characters" className="font-mono uppercase" />
          </Field>
          <Field label="Registered address" htmlFor="address" error={err("address")} aside={badge("address")}>
            <Textarea id="address" name="address" defaultValue={v("address")} autoComplete="street-address" />
          </Field>
        </Card>
      ) : info.idField ? (
        <Card className="space-y-5">
          <Field label={`${info.idField.label} (optional)`} htmlFor="idValue" error={err("idValue")} aside={badge("idValue")}
            hint={hint("idValue", info.idField.placeholder)}>
            <Input id="idValue" name="idValue" defaultValue={v("idValue")} autoCapitalize="characters" className="uppercase" />
          </Field>
          {info.official ? (
            <p className="text-caption text-steel">
              Official roles can&apos;t be confirmed from any public source. A Terminal Admin will approve them in a later phase.
            </p>
          ) : null}
        </Card>
      ) : null}

      <details className="rounded-lg bg-surface p-5 text-body-sm text-charcoal">
        <summary className="flex cursor-pointer items-center gap-2 font-medium"><Info size={16} strokeWidth={1.8} className="text-steel" aria-hidden="true" />What do the badges mean?</summary>
        <ul className="mt-3 space-y-2">
          {(["owned", "exists", "format_valid", "self_declared", "invalid"] as const).map((l) => (
            <li key={l} className="flex items-start gap-3">
              <VerificationBadge level={l} />
              <span>{LEVEL_EXPLAINER[l]}</span>
            </li>
          ))}
        </ul>
      </details>

      {state.error ? <p role="alert" className="text-body-sm text-error">{state.error}</p> : null}
      {state.ok ? <p role="status" className="text-body-sm text-slate">Profile saved.</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Checking…" : "Save profile"}</Button>
      </div>
    </form>
  );
}
