"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Toast = {
  id: string;
  message: string;
};

type ToastContextValue = {
  toast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tm = timers.current[id];
    if (tm) window.clearTimeout(tm);
    delete timers.current[id];
  }, []);

  const toast = useCallback(
    (message: string) => {
      const id = crypto.randomUUID();
      setToasts((t) => [...t, { id, message }]);
      timers.current[id] = window.setTimeout(() => remove(id), 2600);
    },
    [remove]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
        <div className="flex w-full max-w-md flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto rounded-xl border border-theme-border bg-theme-surface/90 px-4 py-3 text-sm font-semibold text-theme-text-primary shadow-xl"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">{t.message}</span>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="shrink-0 text-theme-text-muted hover:text-theme-text-primary"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

