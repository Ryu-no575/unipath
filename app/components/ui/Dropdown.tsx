"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Generic trigger + panel dropdown (click-outside + Escape to close). Same
 * interaction pattern LanguageSwitcher and NotificationBell already used
 * ad hoc -- this is the shared version so new menus don't reinvent it.
 */
export default function Dropdown({
  trigger,
  children,
  align = "end",
  panelClassName = "",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={`absolute z-20 mt-2 min-w-40 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg ${
            align === "end" ? "end-0" : "start-0"
          } ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
