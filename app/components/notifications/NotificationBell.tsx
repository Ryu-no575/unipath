"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { NotificationSummary } from "@/app/lib/data/notifications";

export default function NotificationBell({
  unreadCount,
  recentNotifications,
}: {
  unreadCount: number;
  recentNotifications: NotificationSummary[];
}) {
  const t = useTranslations("Notifications");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("bellLabel")}
        aria-expanded={open}
        className="relative rounded-md p-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {t("heading")}
            </span>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              {t("viewAll")}
            </Link>
          </div>

          {recentNotifications.length === 0 ? (
            <p className="px-2 py-4 text-sm text-zinc-400">{t("empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100">
              {recentNotifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={`/notifications/${notification.id}`}
                    onClick={() => setOpen(false)}
                    className="flex flex-col gap-1 rounded-md px-2 py-2.5 hover:bg-zinc-50"
                  >
                    <div className="flex items-start gap-2">
                      {!notification.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                      )}
                      <span
                        className={`text-sm ${notification.read ? "text-zinc-600" : "font-medium text-zinc-900"}`}
                      >
                        {notification.title}
                      </span>
                    </div>
                    <span className="pl-3.5 text-xs text-zinc-400">
                      {format.relativeTime(new Date(notification.createdAt), now)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 2.5c-2 0-3.4 1.6-3.4 3.6v2.4c0 .6-.2 1.2-.6 1.7L4.5 12.3c-.5.6-.1 1.5.7 1.5h9.6c.8 0 1.2-.9.7-1.5l-1.5-2.1a2.8 2.8 0 0 1-.6-1.7V6.1c0-2-1.4-3.6-3.4-3.6Z" />
      <path d="M8.2 16a1.9 1.9 0 0 0 3.6 0" />
    </svg>
  );
}
