"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { startVisaJourneyAction } from "@/app/lib/actions/visa";
import Button from "@/app/components/ui/Button";

/** On success this redirects (startVisaJourneyAction throws Next's internal
 * redirect signal), so the pending state never actually resolves into
 * "done" -- it either navigates away or, on failure, resolves with an error
 * message to show right here. */
export default function StartVisaJourneyButton({ locale, applicationId }: { locale: AppLocale; applicationId: string }) {
  const t = useTranslations("Visa");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await startVisaJourneyAction(locale, applicationId);
            if (result?.error) setError(result.error);
          })
        }
      >
        {isPending ? t("startButtonPending") : t("startButton")}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
