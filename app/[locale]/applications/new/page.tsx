import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import NewApplicationForm from "@/app/components/applications/NewApplicationForm";
import DevStateError from "@/app/components/DevStateError";

function getParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export default async function NewApplicationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/applications/new">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolvedSearchParams = await searchParams;

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user, profile } = state;
  const supabase = await createClient();
  const [{ data: universities }, { data: customUniversities }, { data: programs }] = await Promise.all([
    supabase
      .from("universities")
      .select("id, official_name, country_code")
      .order("official_name", { ascending: true })
      .limit(500),
    supabase
      .from("user_custom_universities")
      .select("id, university_name, country_code")
      .eq("user_id", user.id)
      .order("university_name", { ascending: true }),
    supabase
      .from("programs")
      .select("id, university_id, official_name, degree_type, field")
      .order("official_name", { ascending: true })
      .limit(2000),
  ]);

  const t = await getTranslations("NewApplication");

  const universityOptions = [
    ...(universities ?? []).map((u) => ({
      id: u.id,
      name: u.official_name,
      countryCode: u.country_code,
      source: "catalog" as const,
    })),
    ...(customUniversities ?? []).map((u) => ({
      id: u.id,
      name: u.university_name,
      countryCode: u.country_code,
      source: "custom" as const,
    })),
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t("heading")}</h1>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <NewApplicationForm
        locale={locale}
        existingUniversities={universityOptions}
        existingPrograms={(programs ?? []).map((p) => ({
          id: p.id,
          universityId: p.university_id,
          name: p.official_name,
          degreeType: p.degree_type,
          field: p.field,
        }))}
        defaultUniversityName={getParam(resolvedSearchParams.universityName)}
        defaultCountryCode={getParam(resolvedSearchParams.country)}
        defaultField={profile.field_of_study ?? ""}
        defaultIntakeYear={profile.intake_year ?? undefined}
        defaultIntakeSeason={profile.intake_season ?? undefined}
      />
    </div>
  );
}
