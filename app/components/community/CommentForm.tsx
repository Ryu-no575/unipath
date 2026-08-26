"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { createCommunityCommentAction } from "@/app/lib/actions/community";

export default function CommentForm({
  locale,
  universityId,
  postId,
  parentCommentId = null,
  autoFocus = false,
  onPosted,
}: {
  locale: AppLocale;
  universityId: string;
  postId: string;
  parentCommentId?: string | null;
  autoFocus?: boolean;
  onPosted?: () => void;
}) {
  const t = useTranslations("Community");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCommunityCommentAction(locale, universityId, postId, parentCommentId, body);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setBody("");
      onPosted?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentCommentId ? t("replyPlaceholder") : t("commentPlaceholder")}
        rows={parentCommentId ? 2 : 3}
        required
        autoFocus={autoFocus}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("posting") : parentCommentId ? t("reply") : t("comment")}
        </button>
      </div>
    </form>
  );
}
