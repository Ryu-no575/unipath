import { useTranslations } from "next-intl";
import type { RouteUniversityCandidate } from "@/app/lib/routes/types";

/** Task brief item 12: this route's own slate of real, verified-catalog
 * programs (app/lib/routes/routeUniversitySelector.ts) -- deliberately
 * different sort/filter criteria per route type, never the same list with a
 * relabeled heading. Empty (not padded) whenever the verified catalog has
 * nothing usable for this route yet -- task brief item 36/38: report real
 * numbers, never fabricate a candidate. */
export default function RouteUniverseCandidates({ candidates }: { candidates: RouteUniversityCandidate[] }) {
  const t = useTranslations("Routes");
  const reasonT = useTranslations("RouteUniversityCandidateReasons");

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-zinc-900">{t("universeHeading")}</h3>
      {candidates.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("universeEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100">
          {candidates.map((c) => (
            <li key={c.programId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="flex flex-col">
                <span className="font-medium text-zinc-900">{c.universityName}</span>
                <span className="text-xs text-zinc-500">{c.programName}</span>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                {reasonT(c.reasonKind)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
