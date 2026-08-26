"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

export default function AuthPageHeader() {
  const t = useTranslations("Navigation");

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
          {t("brand")}
        </Link>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
