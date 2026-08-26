"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { UniversitySearchResult } from "@/app/lib/ror";
import UniversitySearchCard from "./UniversitySearchCard";

type Status = "idle" | "loading" | "success" | "empty" | "error";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 400;

export default function ExploreSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UniversitySearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const t = useTranslations("ExploreSearch");

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setStatus("idle");
      setResults([]);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      return;
    }

    const timeoutId = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");

      fetch(`/api/universities/search?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            setStatus("error");
            return;
          }
          const items: UniversitySearchResult[] = data.results ?? [];
          setResults(items);
          setStatus(items.length > 0 ? "success" : "empty");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="university-search" className="text-sm font-medium text-zinc-700">
          {t("label")}
        </label>
        <input
          id="university-search"
          type="text"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder={t("placeholder")}
          autoComplete="off"
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>

      {status === "idle" && (
        <p className="text-sm text-zinc-400">{t("idle")}</p>
      )}

      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          {t("loading")}
        </div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("error")}
        </div>
      )}

      {status === "empty" && (
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
          {t("empty", { query: query.trim() })}
        </div>
      )}

      {status === "success" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((result) => (
            <UniversitySearchCard key={result.rorId} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}
