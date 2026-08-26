import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { logInAction } from "@/app/lib/actions/auth";
import AuthForm from "@/app/components/auth/AuthForm";
import AuthPageHeader from "@/app/components/auth/AuthPageHeader";

function getParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolvedSearchParams = await searchParams;
  const redirectTo = getParam(resolvedSearchParams.redirectTo);

  const t = await getTranslations("Auth");
  const action = logInAction.bind(null, locale, redirectTo);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AuthPageHeader />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            {t("loginHeading")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t("loginSubheading")}</p>

          <div className="mt-6">
            <AuthForm mode="login" action={action} />
          </div>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {t("noAccount")}{" "}
            <Link href="/signup" className="font-medium text-zinc-900 hover:underline">
              {t("signupLink")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
