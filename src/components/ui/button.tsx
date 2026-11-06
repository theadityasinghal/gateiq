import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "on-dark" | "secondary-on-dark";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md text-[14px] font-medium leading-[1.3] transition-colors duration-150 disabled:cursor-not-allowed min-h-10";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary px-[18px] py-[10px] active:bg-primary-pressed disabled:bg-hairline disabled:text-muted",
  dark: "bg-ink-deep text-canvas px-[18px] py-[10px] active:bg-charcoal disabled:bg-hairline disabled:text-muted",
  secondary: "border border-hairline-strong text-ink px-[18px] py-[10px] active:bg-surface disabled:text-muted",
  ghost: "text-ink px-3 py-2 rounded-sm active:bg-surface",
  "on-dark": "bg-on-dark text-on-light px-[18px] py-[10px]",
  "secondary-on-dark": "border border-on-dark-muted text-on-dark px-[18px] py-[10px]",
};

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(base, variants[variant], className);
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
