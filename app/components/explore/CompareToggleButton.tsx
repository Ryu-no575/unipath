"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/app/components/ui/Toast";
import {
  isInCompare,
  toggleCompare,
  MAX_COMPARE_ITEMS,
  type SavedUniversityItem,
} from "@/app/lib/explore/savedUniversities";

export default function CompareToggleButton({ item }: { item: SavedUniversityItem }) {
  const t = useTranslations("Explore");
  const showToast = useToast();
  const [inCompare, setInCompare] = useState(false);

  useEffect(() => {
    setInCompare(isInCompare(item.key));
  }, [item.key]);

  function handleClick() {
    const result = toggleCompare(item);
    if (result === "full") {
      showToast(t("compareFullToast", { max: MAX_COMPARE_ITEMS }), "neutral");
      return;
    }
    setInCompare(result === "added");
    showToast(result === "added" ? t("addedToCompareToast") : t("removedToast"), "neutral");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={inCompare}
      className={`rounded-md border px-3 py-2 text-center text-sm font-medium transition-colors ${
        inCompare
          ? "border-zinc-900 bg-zinc-100 text-zinc-900"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {inCompare ? t("removeFromCompare") : t("addToCompare")}
    </button>
  );
}
