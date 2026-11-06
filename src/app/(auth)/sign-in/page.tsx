import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { AuthForm } from "./auth-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { TeamCredit } from "@/components/team-credit";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-brand-navy p-12 text-on-dark lg:flex">
        <Logo dark />
        <div>
          <h1 className="text-hero">GateIQ</h1>
          <p className="mt-4 max-w-[440px] text-subtitle text-on-dark-muted">
            Checks the filed shipping bill against what was declared and what arrives at the gate.
          </p>
        </div>
        <TeamCredit className="max-w-[440px] text-on-dark-muted" />
      </section>
      <section className="relative flex flex-col items-center justify-center px-4 py-16">
        <ThemeToggle className="absolute right-4 top-4 sm:right-8 sm:top-8" />
        <div className="w-full max-w-[380px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          <Suspense fallback={<div className="h-80 rounded-lg bg-surface" />}>
            <AuthForm />
          </Suspense>
          <TeamCredit className="mt-12 text-steel lg:hidden" />
        </div>
      </section>
    </main>
  );
}
