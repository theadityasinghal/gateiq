"use client";

import { useActionState, useState } from "react";
import { ROLES, ROLE_INFO, type Role } from "@/lib/roles";
import { tintBg } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/badge";
import { chooseRole, type FormState } from "@/server/onboarding/actions";
import { cn } from "@/lib/cn";
import { Anchor, ArrowRight, Building2, Check, CircleX, DoorOpen, Eye, FileText, Package, Route, Scale, Search, ShieldCheck, Stamp, Truck, type LucideIcon } from "lucide-react";

const ROLE_ICON: Record<Role, LucideIcon> = {
  consignor: Package,
  consignee: Building2,
  cha: FileText,
  transporter: Truck,
  driver: Route,
  gate_officer: DoorOpen,
  weighbridge_operator: Scale,
  customs_inspector: Search,
  customs_superintendent: Stamp,
  terminal_admin: Anchor,
  vigilance_auditor: Eye,
};

export function RolePicker({ current }: { current: Role | null }) {
  const [selected, setSelected] = useState<Role | null>(current);
  const [state, action, pending] = useActionState<FormState, FormData>(chooseRole, {});

  return (
    <form action={action} className="mt-8">
      <fieldset>
        <legend className="sr-only">Account type</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role) => {
            const info = ROLE_INFO[role];
            const checked = selected === role;
            return (
              <label
                key={role}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-lg p-6 text-charcoal transition-shadow",
                  tintBg[info.tint],
                  checked ? "ring-2 ring-primary shadow-card" : "ring-1 ring-transparent",
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={role}
                  checked={checked}
                  onChange={() => setSelected(role)}
                  className="sr-only"
                />
                <span className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 text-h5">
                    {(() => { const I = ROLE_ICON[role]; return <I size={20} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />; })()}
                    {info.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2",
                      checked ? "border-primary bg-primary" : "border-hairline-strong bg-canvas",
                    )}
                  >
                    {checked ? <Check size={12} strokeWidth={3} className="text-on-primary" /> : null}
                  </span>
                </span>
                <span className="text-body-sm">{info.blurb}</span>
                {info.official ? (
                  <span>
                    <Tag tone="gray"><ShieldCheck size={13} strokeWidth={2} aria-hidden="true" />Official role</Tag>
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>
      {state.error ? (
        <p role="alert" className="mt-4 flex items-center gap-1.5 text-body-sm text-error">
          <CircleX size={16} strokeWidth={1.8} aria-hidden="true" />
          {state.error}
        </p>
      ) : null}
      <div className="mt-8 flex justify-end">
        <Button type="submit" disabled={!selected || pending}>
          {pending ? "Saving…" : <>Continue<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></>}
        </Button>
      </div>
    </form>
  );
}
