"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "danger" | "info";
}

const ToastContext = createContext<((message: string, tone?: ToastItem["tone"]) => void) | null>(null);

const TONE_META = {
  success: { icon: CheckCircle2, cls: "text-success bg-success-bg" },
  danger: { icon: AlertCircle, cls: "text-danger bg-danger-bg" },
  info: { icon: Info, cls: "text-info bg-info-bg" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const meta = TONE_META[t.tone];
          const Icon = meta.icon;
          return (
            <div key={t.id} className={`flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm shadow-[var(--shadow-2)] ${meta.cls}`}>
              <Icon className="size-4 shrink-0" aria-hidden />
              {t.message}
              <button onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="ml-2">
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
