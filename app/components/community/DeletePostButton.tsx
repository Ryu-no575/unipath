"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { deleteCommunityPostAction } from "@/app/lib/actions/community";

export default function DeletePostButton({
  locale,
  universityId,
  postId,
}: {
  locale: AppLocale;
  universityId: string;
  postId: string;
}) {
  const t = useTranslations("Community");
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(t("confirmDeletePost"))) return;
    startTransition(() => {
      void deleteCommunityPostAction(locale, universityId, postId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm font-medium text-red-600 transition-colors hover:text-red-800 disabled:opacity-60"
    >
      {t("deletePost")}
    </button>
  );
}
