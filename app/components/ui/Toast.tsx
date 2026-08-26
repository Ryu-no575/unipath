"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface ToastMessage {
  id: number;
  text: string;
  tone: "neutral" | "success" | "danger";
}

const ToastContext = createContext<((text: string, tone?: ToastMessage["tone"]) => void) | null>(
  null,
);

const TONE_CLASSES: Record<ToastMessage["tone"], string> = {
  neutral: "bg-zinc-900 text-white",
  success: "bg-emerald-600 text-white",
  danger: "bg-red-600 text-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: ToastMessage["tone"] = "neutral") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-md px-4 py-2.5 text-sm font-medium shadow-lg ${TONE_CLASSES[toast.tone]}`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  return useMemo(
    () =>
      context ??
      (() => {
        /* no-op outside a ToastProvider */
      }),
    [context],
  );
}
