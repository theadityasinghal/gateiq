"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { PhoneInput } from "@/components/phone-input";
import { DEFAULT_PHONE_COUNTRY, type PhoneCountry } from "@/lib/phone";
import { USERNAME_MAX, normalizeUsername, validateUsername } from "@/lib/username";
import { CircleX, LogIn, UserPlus } from "lucide-react";

/** Only same-site relative paths are accepted as a post-login destination. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

type Mode = "sign-in" | "sign-up";

export function AuthForm({ countries }: { countries: PhoneCountry[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "sign-up" ? "sign-up" : "sign-in");
  const [pending, setPending] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const signInName = normalizeUsername(form.get("signInUsername"));
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const phoneCountry = String(form.get("phoneCountry") ?? "");
    const handle = validateUsername(form.get("username"));

    if (mode === "sign-up") {
      if (name.length < 2) return setError("Enter your name.");
      if (!handle.ok) return setError(handle.message);
      if (phone.replace(/\D/g, "").length < 4) return setError("Enter your mobile number.");
      if (password.length < 8) return setError("Use at least 8 characters for your password.");
      if (password !== form.get("confirm")) return setError("The two passwords don't match.");
    }

    if (mode === "sign-in" && (!signInName || !password)) return setError("Enter your username and password.");

    setPending(true);
    setError(null);
    const res =
      mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password, phone, phoneCountry, username: handle.ok ? handle.username : "" })
        : await authClient.signIn.username({ username: signInName, password });
    if (res.error) {
      setPending(false);
      const code = res.error.code ?? "";
      setError(
        res.error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : res.error.status === 401 || code === "INVALID_USERNAME_OR_PASSWORD"
            ? "That username and password don't match."
            : res.error.status === 422
              ? "That isn't a valid username. Use the username you chose at sign-up, not your email."
              : code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
                ? "An account with this email already exists. Sign in with its username instead."
                : (res.error.message ?? "Something went wrong. Please try again."),
      );
      return;
    }
    setSignedIn(true);
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
        {mode === "sign-in" ? "Use your username and password." : "After this, you choose your account type and fill in your profile."}
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
        {mode === "sign-in" ? (
          <Field label="Username" htmlFor="signInUsername">
            <Input id="signInUsername" name="signInUsername" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. priya.exports" required />
          </Field>
        ) : null}
        {mode === "sign-up" ? (
          <Field label="Username" htmlFor="username" hint="You sign in with it and others use it to add you to cases. It can't be changed, ever.">
            <Input
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={USERNAME_MAX + 1}
              placeholder="e.g. priya.exports"
              required
            />
          </Field>
        ) : null}
        {mode === "sign-up" ? (
          <Field label="Email" htmlFor="email" hint="Not used to sign in. You can change it later.">
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </Field>
        ) : null}
        {mode === "sign-up" ? (
          <Field label="Mobile number" htmlFor="phone" hint="Choose the country code, then type the number.">
            <PhoneInput countries={countries} defaultCountry={DEFAULT_PHONE_COUNTRY} />
          </Field>
        ) : null}
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
          <p role="alert" className="flex items-center gap-1.5 text-caption text-error">
            <CircleX size={14} strokeWidth={1.8} aria-hidden="true" />
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? (signedIn ? "Signed in. Loading…" : mode === "sign-in" ? "Signing in…" : "Creating account…") : mode === "sign-in" ? <><LogIn size={16} strokeWidth={1.8} aria-hidden="true" />Sign in</> : <><UserPlus size={16} strokeWidth={1.8} aria-hidden="true" />Create account</>}
        </Button>
      </form>
    </div>
  );
}
