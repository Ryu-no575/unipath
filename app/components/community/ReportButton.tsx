"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { reportCommunityContentAction } from "@/app/lib/actions/community";

export default function ReportButton({
  locale,
  postId = null,
  commentId = null,
}: {
  locale: AppLocale;
  postId?: string | null;
  commentId?: string | null;
}) {
  const t = useTranslations("Community");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <span className="text-sm text-zinc-400">{t("reportSubmitted")}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
      >
        {t("report")}
      </button>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await reportCommunityContentAction(locale, { postId, commentId }, reason, details);
      if (result?.error) setError(result.error);
      else setDone(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      >
        <option value="">{t("reportReasonPlaceholder")}</option>
        <option value="spam">{t("reportReasonSpam")}</option>
        <option value="harassment">{t("reportReasonHarassment")}</option>
        <option value="misinformation">{t("reportReasonMisinformation")}</option>
        <option value="other">{t("reportReasonOther")}</option>
      </select>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder={t("reportDetailsPlaceholder")}
        rows={2}
        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("posting") : t("submitReport")}
        </button>
      </div>
    </form>
  );
}
