"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/app/components/ui/Toast";
import { isSaved, toggleSaved, type SavedUniversityItem } from "@/app/lib/explore/savedUniversities";

export default function SaveButton({ item }: { item: SavedUniversityItem }) {
  const t = useTranslations("Explore");
  const showToast = useToast();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isSaved(item.key));
  }, [item.key]);

  function handleClick() {
    const nowSaved = toggleSaved(item);
    setSaved(nowSaved);
    showToast(nowSaved ? t("savedToast") : t("removedToast"), nowSaved ? "success" : "neutral");
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
