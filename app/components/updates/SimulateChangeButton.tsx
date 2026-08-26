"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { simulateChangeAction } from "@/app/lib/actions/live-data";

/** Development-only control: fires simulateChangeAction, which writes a real
 * change_event + notification(s) to Supabase (see app/lib/live-data/simulate.ts)
 * -- not local state, so the result is still there after a refresh. Only
 * ever rendered by the Dashboard when NODE_ENV === "development" (see
 * app/[locale]/dashboard/page.tsx), never in production. */
export default function SimulateChangeButton({ locale }: { locale: AppLocale }) {
  const t = useTranslations("SimulateChange");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await simulateChangeAction(locale);
            if (result.error) {
              setMessage(result.error);
            } else {
              setMessage(t("success"));
              router.refresh();
            }
          })
        }
        className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
      >
        {isPending ? t("pending") : t("button")}
      </button>
      {message && <span className="text-xs text-zinc-500">{message}</span>}
    </div>
  );
}
