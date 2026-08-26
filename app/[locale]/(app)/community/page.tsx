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
import PageHeader from "@/app/components/ui/PageHeader";
import SectionHeader from "@/app/components/ui/SectionHeader";
import Card from "@/app/components/ui/Card";

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
      <PageHeader title={t("mainHeading")} description={t("mainSubheading")} />

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
          <SectionHeader title={t("searchResultsHeading", { query })} />
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
          <SectionHeader title={t("yourCommunities")} />
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
        <SectionHeader title={t("popularCommunities")} />
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
        <SectionHeader title={t("recentDiscussions")} />
        {recentDiscussions.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("noRecentDiscussions")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentDiscussions.map((post) => (
              <Card
                key={post.id}
                as={Link}
                href={`/universities/${post.universityId}/community/${post.id}`}
                interactive
                padding="sm"
                className="flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-500">{post.universityName}</span>
                  <span className="text-xs text-zinc-400">
                    {format.relativeTime(new Date(post.createdAt), now)}
                  </span>
                </div>
                {post.title && <h3 className="text-sm font-semibold text-zinc-900">{post.title}</h3>}
                <p className="line-clamp-2 text-sm text-zinc-600">{post.body}</p>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
