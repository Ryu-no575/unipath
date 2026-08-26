import { defineRouting } from "next-intl/routing";

// Locales live in one place so adding a new language later is a one-line change
// (add the code here + `messages/<code>.json`); everything else picks it up.
export const locales = ["en", "ja", "es", "zh-CN", "ko"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";

export const localeLabels: Record<AppLocale, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
  "zh-CN": "简体中文",
  ko: "한국어",
};

// RTL locales aren't supported yet (e.g. Arabic), but keeping this as a list
// (rather than special-casing one locale) is what makes adding one later safe.
export const rtlLocales: readonly string[] = [];

export function isRtlLocale(locale: string): boolean {
  return rtlLocales.includes(locale);
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  localeDetection: true,
});
