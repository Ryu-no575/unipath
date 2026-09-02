import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient, getOptionalUser } from "@/app/lib/supabase/server";
import { getUniversityForCommunity, listCommunityPosts } from "@/app/lib/data/community";
import UniversityTabs from "@/app/components/universities/UniversityTabs";
import PostCard from "@/app/components/community/PostCard";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { Link } from "@/i18n/navigation";

const PREVIEW_LIMIT = 5;

export default async function UniversityStudentRealityPage({
  params,
}: PageProps<"/[locale]/universities/[id]/student-reality">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const supabase = await createClient();
  const [university, user, { data: studentStats }] = await Promise.all([
    getUniversityForCommunity(supabase, id),
    getOptionalUser(),
    supabase
      .from("universities")
      .select(
        "total_students, international_students, international_student_percentage, student_stats_academic_year, student_stats_source_name, student_stats_source_url, student_stats_last_verified_at",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!university) notFound();

  // "experience" posts are the closest existing category to "student
  // reality" (see app/lib/community-types.ts); fall back to the university's
  // most recent posts of any type when there aren't any yet.
  let posts = await listCommunityPosts(supabase, id, { postType: "experience" }, user?.id ?? null);
  if (posts.length === 0) {
    posts = await listCommunityPosts(supabase, id, {}, user?.id ?? null);
  }
  posts = posts.slice(0, PREVIEW_LIMIT);

  const t = await getTranslations("UniversityDetail");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{university.name}</h1>
      </div>

      <UniversityTabs universityId={id} active="studentReality" />

      {/* Task item 6: international student statistics -- admin-entered
          only (no automated importer exists for this data), and every
          missing field renders "Being verified" rather than an estimate. */}
      <Card padding="lg" className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-zinc-900">{t("internationalStudentsHeading")}</h2>
        {studentStats?.international_students != null ? (
          <>
            <p className="text-2xl font-semibold text-zinc-900">
              {studentStats.international_students.toLocaleString(locale)}
            </p>
            {studentStats.international_student_percentage != null && (
              <p className="text-sm text-zinc-600">
                {t("internationalStudentsPercentOfBody", { percent: studentStats.international_student_percentage })}
              </p>
            )}
            {studentStats.student_stats_academic_year && (
              <p className="text-xs text-zinc-400">{t("academicYear", { year: studentStats.student_stats_academic_year })}</p>
            )}
            {studentStats.student_stats_source_name && (
              <p className="text-xs text-zinc-400">
                {studentStats.student_stats_source_url ? (
                  <a
                    href={studentStats.student_stats_source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-2 hover:text-zinc-700"
                  >
                    {studentStats.student_stats_source_name}
                  </a>
                ) : (
                  studentStats.student_stats_source_name
                )}
              </p>
            )}
            {studentStats.student_stats_last_verified_at && (
              <p className="text-xs text-zinc-400">
                {t("lastVerified", { date: new Date(studentStats.student_stats_last_verified_at).toLocaleDateString(locale) })}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-400">{t("beingVerified")}</p>
        )}
      </Card>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          {t("studentRealityHeading")}
        </h2>
        <p className="text-sm text-zinc-500">{t("studentRealityBody")}</p>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title={t("studentRealityEmpty")}
          action={<Button href={`/universities/${id}/community/new`}>{t("studentRealityCta")}</Button>}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PostCard key={post.id} universityId={id} post={post} />
            ))}
          </div>
          <Link
            href={`/universities/${id}/community`}
            className="w-fit text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
          >
            {t("studentRealityViewAll")}
          </Link>
        </>
      )}
    </div>
  );
}
