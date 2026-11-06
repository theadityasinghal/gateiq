"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** Only same-site relative paths are accepted as a post-login destination. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

type Mode = "sign-in" | "sign-up";

export function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "sign-up" ? "sign-up" : "sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    if (mode === "sign-up") {
      if (name.length < 2) return setError("Enter your name.");
      if (password.length < 8) return setError("Use at least 8 characters for your password.");
      if (password !== form.get("confirm")) return setError("The two passwords don't match.");
    }

    setPending(true);
    setError(null);
    const res =
      mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
    if (res.error) {
      setPending(false);
      setError(
        res.error.status === 401 || res.error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "That email and password don't match."
          : res.error.code === "USER_ALREADY_EXISTS" || res.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "An account with this email already exists. Sign in instead."
            : (res.error.message ?? "Something went wrong. Please try again."),
      );
      return;
    }
    router.replace(mode === "sign-up" ? "/onboarding" : safeNext(params.get("next")));
    router.refresh();
  }

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  return (
    <div>
      <h2 className="text-h3">{mode === "sign-in" ? "Sign in to GateIQ" : "Create your account"}</h2>
      <p className="mt-2 text-slate">
        {mode === "sign-in" ? "Use the email and password you signed up with." : "After this, you choose your account type and fill in your profile."}
      </p>

      <div className="mt-6 flex gap-1 rounded-md bg-surface p-1" role="tablist">
        {(["sign-in", "sign-up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchTo(m)}
            className={cn(
              "h-9 flex-1 rounded-sm text-[14px] font-medium",
              mode === m ? "bg-canvas text-ink shadow-subtle" : "text-steel",
            )}
          >
            {m === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form key={mode} onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        {mode === "sign-up" ? (
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required />
          </Field>
        ) : null}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint={mode === "sign-up" ? "At least 8 characters." : undefined}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            required
          />
        </Field>
        {mode === "sign-up" ? (
          <Field label="Confirm password" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </Field>
        ) : null}
        {error ? (
          <p role="alert" className="text-caption text-error">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? (mode === "sign-in" ? "Signing in…" : "Creating account…") : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
