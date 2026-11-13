"use client";

import type { ComponentProps } from "react";

/**
 * A link to another section of the case you are already on. All six sections are in the page already, so a
 * plain click only changes the address (pushState, which Next keeps in sync with usePathname) and nothing is
 * fetched. Ctrl/Cmd/Shift/middle clicks, and no-JavaScript, still follow the link normally.
 */
export function CaseSectionLink({ href, onClick, children, ...rest }: ComponentProps<"a"> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (window.location.pathname + window.location.search !== href) window.history.pushState(null, "", href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
