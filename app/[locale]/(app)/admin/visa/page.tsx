import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { listVisaProfiles } from "@/app/lib/data/adminVisa";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import { CreateVisaProfileForm } from "@/app/components/admin/AdminVisaForms";

export default async function AdminVisaPage({ params }: PageProps<"/[locale]/admin/visa">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("AdminVisa");
  const supabase = await createClient();
  const profiles = await listVisaProfiles(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-zinc-700">{t("createHeading")}</h3>
        <CreateVisaProfileForm />
      </Card>

      <Card padding="none" className="overflow-x-auto">
        {profiles.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">{t("empty")}</p>
        ) : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">{t("columnNationality")}</th>
                <th className="px-4 py-3 font-medium">{t("columnDestination")}</th>
                <th className="px-4 py-3 font-medium">{t("columnStudyLevel")}</th>
                <th className="px-4 py-3 font-medium">{t("columnStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("columnItems")}</th>
                <th className="px-4 py-3 font-medium">{t("columnSources")}</th>
                <th className="px-4 py-3 font-medium">{t("columnJourneys")}</th>
                <th className="px-4 py-3 font-medium">{t("columnLastChecked")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {profiles.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/visa/${p.id}`} className="font-medium text-zinc-900 hover:underline">
                      {p.nationalityCountry}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{p.destinationCountry}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.studyLevel}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.status === "verified" ? "success" : "warning"}>
                      {p.status === "verified" ? t("statusVerified") : t("statusBeingVerified")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{p.itemCount}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.sourceCount}</td>
                  <td className="px-4 py-3 text-zinc-600">{p.activeJourneyCount}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {p.lastCheckedAt ? new Date(p.lastCheckedAt).toLocaleDateString(locale) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
