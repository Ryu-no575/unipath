"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import type { FeedbackCategory } from "@/app/lib/supabase/database.types";
import { submitFeedbackAction } from "@/app/lib/actions/feedback";

const CATEGORIES: FeedbackCategory[] = [
  "confusing",
  "wrong_information",
  "missing_university",
  "bug",
  "feature_request",
  "other",
];

/**
 * Always-available feedback entry point (AGENTS.md section 18) -- a small
 * floating button on every (app) page, guest browsing included (this is
 * mounted in the (app) layout alongside NavShell, not inside it, so it
 * never depends on whichever guest/authed nav variant is rendering).
 */
export default function FeedbackWidget({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Feedback");
  const categoryT = useTranslations("FeedbackCategoryOptions");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitFeedbackAction(locale, { category, message, pagePath: pathname });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSent(true);
      setMessage("");
    });
  }

  function close() {
    setOpen(false);
    setSent(false);
    setError(null);
  }

  useEffect(() => {
    if (!open) return;
    function handleHardwareBack(event: Event) {
      event.preventDefault();
      close();
    }
    window.addEventListener("unipath:hardwareBack", handleHardwareBack);
    return () => window.removeEventListener("unipath:hardwareBack", handleHardwareBack);
  }, [open]);

  return (
    <div
      className="fixed right-[calc(1rem+var(--safe-right))] z-40 bottom-[calc(4.75rem+var(--safe-bottom))] sm:bottom-[calc(1rem+var(--safe-bottom))]"
    >
      {open ? (
        <div className="flex w-72 flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">{t("heading")}</h2>
            <button type="button" onClick={close} className="text-zinc-400 hover:text-zinc-700" aria-label={t("close")}>
              ✕
            </button>
          </div>

          {sent ? (
            <p className="text-sm text-emerald-600">{t("thanks")}</p>
          ) : (
            <>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryT(c)}
                  </option>
                ))}
              </select>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("placeholder")}
                rows={3}
                className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
              >
                {isPending ? t("sending") : t("send")}
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-zinc-700"
        >
          {t("button")}
        </button>
      )}
    </div>
  );
}
