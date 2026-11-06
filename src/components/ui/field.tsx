import { cn } from "@/lib/cn";
import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-md border border-hairline-strong bg-canvas px-4 text-[16px] text-ink placeholder:text-muted focus:border-2 focus:border-primary focus:px-[15px] focus:outline-none aria-[invalid=true]:border-error";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10", className)} {...props}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23787671' stroke-width='1.5'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-3 focus:py-[11px]", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  aside,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[14px] font-medium text-charcoal">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="text-caption text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-steel">{hint}</p>
      ) : null}
    </div>
  );
}
