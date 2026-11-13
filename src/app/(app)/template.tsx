import { ViewTransition } from "react";

/**
 * A template remounts on every navigation, so the old page content fades out while the header and sidebar
 * (which live in the layout) stay put. The new page rises in through `animate-rise` on its own root. The CSS for
 * "page-out" is in globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
