"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import type { CommunityPostType } from "@/app/lib/supabase/database.types";
import { COMMUNITY_POST_TYPES, type CommunityProgramOption } from "@/app/lib/community-types";
import { createCommunityPostAction } from "@/app/lib/actions/community";

const inputClasses =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const labelClasses = "text-sm font-medium text-zinc-700";

export default function NewCommunityPostForm({
  locale,
  universityId,
  programs,
}: {
  locale: AppLocale;
  universityId: string;
  programs: CommunityProgramOption[];
}) {
  const t = useTranslations("Community");
  const postTypes = useTranslations("PostTypeOptions");
  const common = useTranslations("Common");

  const [postType, setPostType] = useState<CommunityPostType>("question");
  const [programId, setProgramId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCommunityPostAction(locale, {
        universityId,
        programId,
        postType,
        title,
        body,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-6">
      <label className="flex flex-col gap-1.5">
        <span className={labelClasses}>{t("postTypeLabel")}</span>
        <select
          value={postType}
          onChange={(e) => setPostType(e.target.value as CommunityPostType)}
          className={inputClasses}
        >
          {COMMUNITY_POST_TYPES.map((type) => (
            <option key={type} value={type}>
              {postTypes(type)}
            </option>
          ))}
        </select>
      </label>

      {programs.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className={labelClasses}>{t("programLabel")}</span>
          <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={inputClasses}>
            <option value="">{common("selectPlaceholder")}</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={labelClasses}>{t("titleLabel")}</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          className={inputClasses}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClasses}>{t("bodyLabel")}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("bodyPlaceholder")}
          rows={6}
          required
          className={inputClasses}
        />
      </label>

      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
        >
          {isPending ? t("posting") : t("post")}
        </button>
      </div>
    </form>
  );
}
