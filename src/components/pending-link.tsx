"use client";

import Link, { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";

function Spinner() {
  const { pending } = useLinkStatus();
  return pending ? <LoaderCircle size={14} strokeWidth={2} className="ml-auto shrink-0 animate-spin text-steel" aria-label="Loading" role="status" /> : null;
}

/** A link that shows a small spinner from the click until the next page has loaded. */
export function PendingLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <Spinner />
    </Link>
  );
}
