"use client";

import { useOptimistic, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { useToast } from "@/components/toast";

/**
 * Optimistic writes. `apply` shows the change on screen at once; the Server Action then runs inside the same
 * transition. When it succeeds, the revalidated server data replaces the optimistic state. When it returns
 * `{ ok: false }` or throws, React drops the optimistic state (the screen goes back to what the server has)
 * and a toast says why. The database is still the truth: nothing here skips the write.
 */
export function useOptimisticAction<S, A>(state: S, reducer: (state: S, action: A) => S) {
  const [optimistic, apply] = useOptimistic(state, reducer);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function run(action: A, server: () => Promise<ActionResult>, opts: { success?: string; failure?: string } = {}) {
    startTransition(async () => {
      apply(action);
      try {
        const r = await server();
        if (!r.ok) toast.error(r.error);
        else if (opts.success) toast.success(opts.success);
      } catch {
        toast.error(opts.failure ?? "Something went wrong and your change was not saved.");
      }
    });
  }

  return [optimistic, run, pending] as const;
}
