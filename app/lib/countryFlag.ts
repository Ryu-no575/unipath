import type { CountryCode } from "@/app/lib/countries";

const REGIONAL_INDICATOR_OFFSET = 127397;

/**
 * Derives the flag emoji for an ISO 3166-1 alpha-2 code from the two
 * Unicode regional-indicator symbols, so we never need a flag icon asset
 * set — same source of truth as `COUNTRY_CODES` in `app/lib/countries.ts`.
 * A couple of codes in that list (e.g. XK) have no real corresponding flag
 * emoji; callers should always pair this with the text label, never rely
 * on the flag alone.
 */
export function flagEmoji(code: CountryCode | string): string {
  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(REGIONAL_INDICATOR_OFFSET + char.charCodeAt(0)))
    .join("");
}
