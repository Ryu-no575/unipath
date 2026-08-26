import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { LatestUpdateItem } from "@/app/lib/data/live-updates";
import ImportanceBadge from "./ImportanceBadge";
import OfficialSourceLink from "./OfficialSourceLink";

/** Dashboard "Latest Updates" feed -- official-source changes affecting the
 * user's saved/applied universities and programs. Always rendered, with the
 * heading visible even when there are zero items, so the section is never
 * silently missing from the Dashboard. */
export default function LatestUpdates({ items }: { items: LatestUpdateItem[] }) {
  const t = useTranslations("LatestUpdates");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">{t("heading")}</h2>

      {items.length === 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-zinc-600">{t("emptyTitle")}</p>
          <p className="text-sm text-zinc-500">{t("emptyBody")}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-900">
                  {item.universityName ?? t("unknownEntity")}
                  {item.programName ? ` — ${item.programName}` : ""}
                </span>
                <ImportanceBadge importance={item.importance} />
              </div>

              <p className="text-sm text-zinc-600">
                {item.oldValue != null && item.newValue != null
                  ? t("fieldChangedWithValues", {
                      field: item.fieldLabel,
                      oldValue: item.oldValue,
                      newValue: item.newValue,
                    })
                  : t("fieldChanged", { field: item.fieldLabel })}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <OfficialSourceLink url={item.officialUrl} publisher={item.sourcePublisher} />
                <span className="text-xs text-zinc-400">
                  {format.relativeTime(new Date(item.detectedAt))}
                </span>
                <Link
                  href={`/changes/${item.id}`}
                  className="text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
                >
                  {t("viewChange")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
