"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { runDueValidationsAction } from "@/app/lib/actions/live-data";

/** Manually kicks off a batch of due Source Validation checks (see
 * app/lib/live-data/scheduler.ts) so Source Health can be seen moving
 * without waiting for the schedule to come due on its own. */
export default function ValidateSourcesButton({ locale }: { locale: AppLocale }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const outcome = await runDueValidationsAction(locale);
            if (outcome.error) {
              setMessage(outcome.error);
            } else if (outcome.summary) {
              setMessage(t("validateSourcesResult", { count: outcome.summary.attempted }));
              router.refresh();
            }
          })
        }
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? t("validateSourcesPending") : t("validateSourcesButton")}
      </button>
      {message && <span className="text-xs text-zinc-500">{message}</span>}
    </div>
  );
}
