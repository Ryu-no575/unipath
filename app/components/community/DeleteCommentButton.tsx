"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { deleteCommunityCommentAction } from "@/app/lib/actions/community";

export default function DeleteCommentButton({
  locale,
  universityId,
  postId,
  commentId,
}: {
  locale: AppLocale;
  universityId: string;
  postId: string;
  commentId: string;
}) {
  const t = useTranslations("Community");
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(t("confirmDeleteComment"))) return;
    startTransition(() => {
      void deleteCommunityCommentAction(locale, universityId, postId, commentId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-red-600 transition-colors hover:text-red-800 disabled:opacity-60"
    >
      {t("deleteComment")}
    </button>
  );
}
