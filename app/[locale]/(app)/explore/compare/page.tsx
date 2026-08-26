"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageHeader from "@/app/components/ui/PageHeader";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import EmptyState from "@/app/components/ui/EmptyState";
import {
  EXPLORE_COLLECTION_EVENT,
  getCompareList,
  removeFromCompare,
  type SavedUniversityItem,
} from "@/app/lib/explore/savedUniversities";

export default function CompareUniversitiesPage() {
  const t = useTranslations("Explore");
  const [items, setItems] = useState<SavedUniversityItem[] | null>(null);

  useEffect(() => {
    const refresh = () => setItems(getCompareList());
    refresh();
    window.addEventListener(EXPLORE_COLLECTION_EVENT, refresh);
    return () => window.removeEventListener(EXPLORE_COLLECTION_EVENT, refresh);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("tabCompare")} />

      {items === null ? null : items.length < 2 ? (
        <EmptyState
          title={t("compareEmptyHeading")}
          description={t("compareEmptyBody")}
          action={<Button href="/explore">{t("compareEmptyCta")}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.key} className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-zinc-900">{item.name}</h3>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
                  <dt className="text-zinc-400">{t("locationLabel")}</dt>
                  <dd className="font-medium text-zinc-900">{item.location ?? "—"}</dd>
                </div>
              </dl>
              <div className="mt-auto flex items-center gap-2 border-t border-zinc-100 pt-3">
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    {t("view")}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    {t("view")}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => removeFromCompare(item.key)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  {t("remove")}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
