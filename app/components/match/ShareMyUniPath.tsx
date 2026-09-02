"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";

export default function ShareMyUniPath({
  university,
  program,
  year,
  origin,
  destination,
}: {
  university: string;
  program?: string | null;
  year?: string | null;
  origin?: string | null;
  destination?: string | null;
}) {
  const t = useTranslations("Share");
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const params = new URLSearchParams({ university });
  if (program) params.set("program", program);
  if (year) params.set("year", year);
  if (origin) params.set("origin", origin);
  if (destination) params.set("destination", destination);
  const imageUrl = `/api/share-image?${params.toString()}`;

  async function handleShare() {
    setSharing(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "my-unipath.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My UniPath" });
        return;
      }
    } catch {
      // Fall through to the download link below -- native share isn't
      // available/allowed in every browser or the Capacitor WebView.
    } finally {
      setSharing(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
      >
        {t("shareMyUniPath")}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-soft">
      <p className="text-sm font-medium text-navy-900">{t("previewHeading")}</p>
      <div className="w-full max-w-[220px]">
        <Image
          src={imageUrl}
          alt={t("previewAlt")}
          width={220}
          height={391}
          unoptimized
          className="h-auto w-full rounded-xl border border-zinc-200 shadow-elevated"
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {sharing ? t("sharing") : t("shareButton")}
        </button>
        <a
          href={imageUrl}
          download="my-unipath.png"
          className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          {t("downloadButton")}
        </a>
      </div>
      <p className="text-center text-xs text-zinc-400">{t("privacyNote")}</p>
    </div>
  );
}
