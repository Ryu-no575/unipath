"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { checkSourceAction } from "@/app/lib/actions/live-data";

/** Fires the real checkSource() pipeline for one already-registered official
 * source: fetch -> hash -> compare -> change_events -> notifications, all
 * written to Supabase (see app/lib/live-data/checkSource.ts) -- not local
 * state, so the result is still there after a refresh. */
export default function CheckSourceButton({
  locale,
  sourceId,
}: {
  locale: AppLocale;
  sourceId: string;
}) {
  const t = useTranslations("LiveData");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function describe(status: string, error?: string): string {
    switch (status) {
      case "changed":
        return t("checkResultChanged");
      case "unchanged":
        return t("checkResultUnchanged");
      case "skipped_recent_check":
        return t("checkResultSkippedRecent");
      case "skipped_disallowed":
        return t("checkResultSkippedRobots");
      case "skipped_unsafe_url":
        return t("checkResultSkippedUnsafe");
      case "fetch_failed":
        return t("checkResultFetchFailed", { error: error ?? "" });
      case "not_found":
        return t("checkResultNotFound");
      case "gone":
        return t("checkResultGone");
      case "invalid_domain":
        return t("checkResultInvalidDomain");
      default:
        return status;
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const outcome = await checkSourceAction(locale, sourceId);
            if (outcome.error) {
              setMessage(outcome.error);
            } else if (outcome.result) {
              setMessage(
                describe(
                  outcome.result.status,
                  "error" in outcome.result ? outcome.result.error : undefined,
                ),
              );
              router.refresh();
            }
          })
        }
        className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? t("checkSourcePending") : t("checkSourceButton")}
      </button>
      {message && <span className="text-xs text-zinc-500">{message}</span>}
    </div>
  );
}
