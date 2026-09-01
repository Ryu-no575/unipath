import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { getAdminVisaProfileDetail } from "@/app/lib/data/adminVisa";
import { rejectSourceAction, unrejectSourceAction } from "@/app/lib/actions/admin";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import SectionHeader from "@/app/components/ui/SectionHeader";
import AdminActionButton from "@/app/components/admin/AdminActionButton";
import CheckSourceButton from "@/app/components/updates/CheckSourceButton";
import {
  UpdateVisaProfileForm,
  AddVisaItemForm,
  DeleteVisaItemButton,
  AddVisaSourceForm,
} from "@/app/components/admin/AdminVisaForms";

export default async function AdminVisaProfileDetailPage({
  params,
}: PageProps<"/[locale]/admin/visa/[id]">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const t = await getTranslations("AdminVisa");
  const itemT = await getTranslations("VisaItemOptions");
  const supabase = await createClient();
  const profile = await getAdminVisaProfileDetail(supabase, id);
  if (!profile) notFound();

  const nextOrderIndex = profile.items.length > 0 ? Math.max(...profile.items.map((i) => i.orderIndex)) + 1 : 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">
            {t("profileHeading", { nationality: profile.nationalityCountry, destination: profile.destinationCountry })}
          </h2>
          <Badge tone={profile.status === "verified" ? "success" : "warning"}>
            {profile.status === "verified" ? t("statusVerified") : t("statusBeingVerified")}
          </Badge>
        </div>
        <p className="text-sm text-zinc-500">{profile.studyLevel}</p>
      </div>

      <Card>
        <SectionHeader title={t("editHeading")} />
        <div className="mt-4">
          <UpdateVisaProfileForm
            profileId={profile.id}
            initialVisaType={profile.visaType ?? ""}
            initialSummary={profile.summary ?? ""}
            initialStatus={profile.status}
          />
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <SectionHeader title={t("itemsHeading")} />
        <Card padding="none">
          {profile.items.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">{t("itemsEmpty")}</p>
          ) : (
            <ul className="divide-y divide-zinc-100 px-6">
              {profile.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-zinc-900">{item.title || itemT(item.itemKey)}</span>
                    {item.description && <span className="text-sm text-zinc-500">{item.description}</span>}
                    {!item.required && <span className="text-xs text-zinc-400">{t("optionalLabel")}</span>}
                  </div>
                  <DeleteVisaItemButton profileId={profile.id} itemId={item.id} />
                </li>
              ))}
            </ul>
          )}
          <div className="p-6 pt-0">
            <AddVisaItemForm profileId={profile.id} nextOrderIndex={nextOrderIndex} />
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHeader title={t("sourcesHeading")} />
        <Card padding="none">
          {profile.sources.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">{t("sourcesEmpty")}</p>
          ) : (
            <ul className="divide-y divide-zinc-100 px-6">
              {profile.sources.map((source) => (
                <li key={source.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="max-w-[360px] truncate text-sm text-zinc-700 underline underline-offset-2 hover:text-zinc-900">
                        {source.url}
                      </a>
                    ) : (
                      <span className="text-sm text-zinc-400">—</span>
                    )}
                    <span className="text-xs text-zinc-400">
                      {source.urlStatus} · {source.lastCheckedAt ? new Date(source.lastCheckedAt).toLocaleString(locale) : t("neverChecked")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckSourceButton locale={typedLocale} sourceId={source.id} />
                    {source.adminRejected ? (
                      <AdminActionButton
                        label={t("unrejectButton")}
                        variant="secondary"
                        action={async () => {
                          "use server";
                          return unrejectSourceAction(typedLocale, source.id);
                        }}
                      />
                    ) : (
                      <AdminActionButton
                        label={t("rejectButton")}
                        variant="danger"
                        action={async () => {
                          "use server";
                          return rejectSourceAction(typedLocale, source.id);
                        }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="p-6 pt-0">
            <AddVisaSourceForm profileId={profile.id} />
          </div>
        </Card>
      </div>
    </div>
  );
}
