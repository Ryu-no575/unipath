"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { toggleCommunityPostLikeAction } from "@/app/lib/actions/community";

export default function LikeButton({
  locale,
  universityId,
  postId,
  initialLiked,
  initialCount,
  canLike,
}: {
  locale: AppLocale;
  universityId: string;
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  canLike: boolean;
}) {
  const t = useTranslations("Community");
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!canLike || isPending) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    startTransition(async () => {
      const result = await toggleCommunityPostLikeAction(locale, universityId, postId);
      if (result?.error || typeof result.liked !== "boolean") {
        // Revert the optimistic update on failure.
        setLiked(!nextLiked);
        setCount((c) => c + (nextLiked ? -1 : 1));
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canLike || isPending}
      aria-pressed={liked}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        liked
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <HeartIcon filled={liked} />
      {t("likeCount", { count })}
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M10 17.3s-6.5-4-8.2-8.1C.6 6.1 2.4 3.4 5.3 3.2c1.6-.1 3.1.7 4 2 .9-1.3 2.4-2.1 4-2 2.9.2 4.7 2.9 3.5 6-1.7 4.1-8.2 8.1-8.2 8.1Z" />
    </svg>
  );
}
