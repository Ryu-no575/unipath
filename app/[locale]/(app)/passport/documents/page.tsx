import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getUserState } from "@/app/lib/supabase/user-state";
import { getApplicationsWithDetails } from "@/app/lib/data/applications";
import { getApplicationDocuments, getDocumentLinksForUser } from "@/app/lib/data/passport";
import DevStateError from "@/app/components/DevStateError";
import DocumentList from "@/app/components/passport/DocumentList";
import PageHeader from "@/app/components/ui/PageHeader";

export default async function PassportDocumentsPage({
  params,
}: PageProps<"/[locale]/passport/documents">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const state = await getUserState();
  if (state.status === "unauthenticated") redirect(`/${locale}/login`);
  if (state.status === "needs_onboarding") redirect(`/${locale}/onboarding`);
  if (state.status === "error") return <DevStateError message={state.message} />;

  const { user } = state;
  const supabase = await createClient();
  const [documents, links, applications] = await Promise.all([
    getApplicationDocuments(supabase, user.id),
    getDocumentLinksForUser(supabase),
    getApplicationsWithDetails(supabase, user.id),
  ]);

  const t = await getTranslations("PassportDocuments");
  const applicationsT = await getTranslations("Applications");

  const applicationOptions = applications.map((application) => ({
    id: application.id,
    name: application.university?.name ?? applicationsT("unknownUniversity"),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/passport" className="w-fit text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
        {t("back")}
      </Link>

      <PageHeader title={t("heading")} description={t("subheading")} />

      <DocumentList
        locale={locale}
        documents={documents}
        links={links}
        applicationOptions={applicationOptions}
      />
    </div>
  );
}
