"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { simulateUnlockAction } from "@/app/lib/actions/eligibility";
import type { CredentialOverride, UnlockSimulationResult } from "@/app/lib/eligibility/unlockSimulator";
import Card from "@/app/components/ui/Card";

const fieldClasses =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

/** Task item 5: "What would unlock more options?" Client-side only for the
 * form interaction -- the actual catalog-wide recomputation runs server-side
 * (app/lib/actions/eligibility.ts) since it needs the user's real documents/
 * test scores and the whole program catalog, never shipped to the browser. */
export default function UnlockSimulator() {
  const t = useTranslations("UnlockSimulator");
  const [kind, setKind] = useState<CredentialOverride["kind"]>("english_score");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<UnlockSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setError(t("invalidValue"));
      return;
    }
    startTransition(async () => {
      const response = await simulateUnlockAction({ kind, value: parsed } as CredentialOverride);
      if (response.error) {
        setError(response.error);
        return;
      }
      setResult(response.result ?? null);
    });
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="mt-1 text-xs text-zinc-400">{t("subheading")}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("credentialLabel")}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CredentialOverride["kind"])}
            className={fieldClasses}
          >
            <option value="english_score">{t("englishScoreOption")}</option>
            <option value="gpa_value">{t("gpaOption")}</option>
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">{t("targetValueLabel")}</span>
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={fieldClasses}
            required
          />
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("simulating") : t("simulate")}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="border-t border-zinc-100 pt-4">
          {result.evaluablePrograms === 0 ? (
            <p className="text-sm text-zinc-500">{t("noVerifiedData")}</p>
          ) : result.newlyEligibleCount === 0 ? (
            <p className="text-sm text-zinc-500">{t("noneUnlocked", { count: result.evaluablePrograms })}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-lg font-semibold text-emerald-700">
                {t("unlockedHeadline", { count: result.newlyEligibleCount })}
              </p>
              <ul className="flex flex-col gap-1">
                {result.newlyEligiblePrograms.map((p) => (
                  <li key={p.programId} className="text-sm text-zinc-600">
                    {p.programName} — {p.universityName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
