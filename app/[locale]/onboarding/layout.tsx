import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import AuthPageHeader from "@/app/components/auth/AuthPageHeader";

export default async function OnboardingLayout({
  children,
  params,
}: LayoutProps<"/[locale]/onboarding">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <AuthPageHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
