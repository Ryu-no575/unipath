"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  labelledBy,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Pass when `title` is rendered elsewhere and you want to reuse its id. */
  labelledBy?: string;
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = labelledBy ?? "modal-title";

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    // Android hardware back button (dispatched by NativeShellSetup): close
    // this modal instead of letting the WebView navigate/exit underneath it.
    function handleHardwareBack(event: Event) {
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("unipath:hardwareBack", handleHardwareBack);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("unipath:hardwareBack", handleHardwareBack);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
      style={{
        paddingTop: "max(1rem, var(--safe-top))",
        paddingBottom: "max(1rem, var(--safe-bottom))",
        paddingLeft: "max(1rem, var(--safe-left))",
        paddingRight: "max(1rem, var(--safe-right))",
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-elevated focus:outline-none"
      >
        {title && (
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
