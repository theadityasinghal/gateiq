import { cn } from "@/lib/cn";
import type { ComponentProps } from "react";
import type { Tint } from "@/lib/roles";

export const tintBg: Record<Tint, string> = {
  peach: "bg-tint-peach",
  rose: "bg-tint-rose",
  mint: "bg-tint-mint",
  lavender: "bg-tint-lavender",
  sky: "bg-tint-sky",
  yellow: "bg-tint-yellow",
  cream: "bg-tint-cream",
  gray: "bg-tint-gray",
};

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border border-hairline bg-canvas p-6", className)} {...props} />;
}

export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-h5 text-ink">{title}</h2>
      {description ? <p className="text-body-sm text-slate">{description}</p> : null}
    </div>
  );
}
