import { useTranslations } from "next-intl";

export default function OfficialSourceLink({
  url,
  publisher,
  className = "",
}: {
  url: string | null;
  publisher: string | null;
  className?: string;
}) {
  const t = useTranslations("LiveData");

  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`inline-flex items-center gap-1 text-xs font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700 ${className}`}
    >
      {t("officialSource")}
      {publisher ? ` — ${publisher}` : ""}
    </a>
  );
}
