"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useToast } from "@/app/components/ui/Toast";
import { isSaved, toggleSaved, type SavedUniversityItem } from "@/app/lib/explore/savedUniversities";
import { recordUniversitySavedAction } from "@/app/lib/actions/explore";

export default function SaveButton({
  item,
  loggedIn,
}: {
  item: SavedUniversityItem;
  /** Saving a university is login-required (task brief section 2) -- a
   * guest clicking this is sent to sign up/log in instead of silently
   * writing to localStorage under no account at all. */
  loggedIn: boolean;
}) {
  const t = useTranslations("Explore");
  const showToast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loggedIn) setSaved(isSaved(item.key));
  }, [item.key, loggedIn]);

  function handleClick() {
    if (!loggedIn) {
      // redirectTo must be the full locale-prefixed pathname (see
      // resolveDestination in app/lib/actions/auth.ts) -- usePathname() here
      // is next-intl's locale-stripped version.
      router.push(`/login?redirectTo=${encodeURIComponent(`/${locale}${pathname}`)}`);
      return;
    }
    const nowSaved = toggleSaved(item);
    setSaved(nowSaved);
    showToast(nowSaved ? t("savedToast") : t("removedToast"), nowSaved ? "success" : "neutral");
    if (nowSaved) recordUniversitySavedAction(item.key).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      className={`flex-1 rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors ${
        saved
          ? "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {saved ? t("saved") : t("save")}
    </button>
  );
}
