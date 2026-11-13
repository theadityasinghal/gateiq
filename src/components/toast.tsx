"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleCheck, CircleX, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Toast = { id: number; kind: "error" | "success"; message: string };
type ToastApi = { error: (message: string) => void; success: (message: string) => void };

const ToastContext = createContext<ToastApi>({ error: () => {}, success: () => {} });

export const useToast = () => useContext(ToastContext);

/** Short messages at the bottom right. Errors stay longer, so a change that was rolled back is noticed. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: Toast["kind"], message: string) => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 8000 : 4000);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(() => ({ error: (m) => push("error", m), success: (m) => push("success", m) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-canvas p-3.5 text-body-sm shadow-modal",
              t.kind === "error" ? "border-error/40 text-charcoal" : "border-hairline text-charcoal",
            )}
          >
            {t.kind === "error" ? (
              <CircleX size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
            ) : (
              <CircleCheck size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-tag-green-fg" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1">{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-sm p-0.5 text-steel transition-colors hover:text-ink">
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
