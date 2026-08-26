import { hasLocale } from "next-intl";
import { getFormatter, getNow, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import {
  getPopularCommunities,
  getRecentDiscussions,
  getUserCommunities,
  searchCommunityUniversities,
} from "@/app/lib/data/community";
import UniversityCommunityCard from "@/app/components/community/UniversityCommunityCard";

export default async function CommunityHomePage({
  params,
  searchParams,
}: PageProps<"/[locale]/community">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolvedSearchParams = await searchParams;
  const rawQuery = resolvedSearchParams.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";

  const supabase = await createClient();
  const user = await getOptionalUser();

  const [yourCommunities, popularCommunities, recentDiscussions, searchResults] = await Promise.all([
    user ? getUserCommunities(supabase, user.id) : Promise.resolve([]),
    getPopularCommunities(supabase, 6),
    getRecentDiscussions(supabase, 10),
    query ? searchCommunityUniversities(supabase, query, 10) : Promise.resolve(null),
  ]);

  const t = await getTranslations("Community");
  const format = await getFormatter();
  const now = await getNow();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("mainHeading")}</h1>
        <p className="text-sm text-zinc-500">{t("mainSubheading")}</p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          {t("searchButton")}
        </button>
      </form>

      {searchResults !== null && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">
            {t("searchResultsHeading", { query })}
          </h2>
          {searchResults.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("searchNoResults")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {searchResults.map((u) => (
                <UniversityCommunityCard key={u.id} university={u} />
              ))}
            </div>
          )}
        </section>
      )}

      {user && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-zinc-900">{t("yourCommunities")}</h2>
          {yourCommunities.length === 0 ? (
            <p className="text-sm text-zinc-400">{t("noUserCommunities")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {yourCommunities.map((u) => (
                <UniversityCommunityCard key={u.id} university={u} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-900">{t("popularCommunities")}</h2>
        {popularCommunities.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noPopularCommunities")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {popularCommunities.map((u) => (
              <UniversityCommunityCard key={u.id} university={u} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-zinc-900">{t("recentDiscussions")}</h2>
        {recentDiscussions.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noRecentDiscussions")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentDiscussions.map((post) => (
              <Link
                key={post.id}
                href={`/universities/${post.universityId}/community/${post.id}`}
                className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-500">{post.universityName}</span>
                  <span className="text-xs text-zinc-400">
                    {format.relativeTime(new Date(post.createdAt), now)}
                  </span>
                </div>
                {post.title && <h3 className="text-sm font-semibold text-zinc-900">{post.title}</h3>}
                <p className="line-clamp-2 text-sm text-zinc-600">{post.body}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
