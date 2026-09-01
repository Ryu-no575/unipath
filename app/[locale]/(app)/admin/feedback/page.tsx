import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { AppLocale } from "@/i18n/routing";
import { createClient } from "@/app/lib/supabase/server";
import { listFeedback } from "@/app/lib/data/adminFeedback";
import { markFeedbackReviewedAction } from "@/app/lib/actions/admin";
import Card from "@/app/components/ui/Card";
import Badge from "@/app/components/ui/Badge";
import AdminActionButton from "@/app/components/admin/AdminActionButton";

export default async function AdminFeedbackPage({ params }: PageProps<"/[locale]/admin/feedback">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const typedLocale = locale as AppLocale;

  const t = await getTranslations("AdminFeedback");
  const categoryT = await getTranslations("FeedbackCategoryOptions");
  const supabase = await createClient();
  const feedback = await listFeedback(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-zinc-900">{t("heading")}</h2>
        <p className="text-sm text-zinc-500">{t("subheading")}</p>
      </div>

      <Card padding="none">
        {feedback.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 px-6">
            {feedback.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{categoryT(f.category)}</Badge>
                    {f.fromGuest && <Badge tone="info">{t("guestLabel")}</Badge>}
                    {f.status === "reviewed" && <Badge tone="success">{t("reviewedLabel")}</Badge>}
                    <span className="text-xs text-zinc-400">{new Date(f.createdAt).toLocaleString(locale)}</span>
                  </div>
                  <p className="text-sm text-zinc-800">{f.message}</p>
                  {f.pagePath && <span className="text-xs text-zinc-400">{f.pagePath}</span>}
                </div>
                {f.status !== "reviewed" && (
                  <AdminActionButton
                    label={t("markReviewedButton")}
                    variant="secondary"
                    action={async () => {
                      "use server";
                      return markFeedbackReviewedAction(typedLocale, f.id);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
