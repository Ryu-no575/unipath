// A short, curated list of IANA zones covering where UniPath's students and
// the universities they apply to are actually located. Not exhaustive by
// design — paired with a free-text input, this is a set of good defaults to
// pick from, not a validated enum, since inventing a "complete" IANA list by
// hand would just get stale.
export const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Istanbul",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "America/Bogota",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
] as const;

/** Best-effort browser timezone detection; never throws. */
export function detectBrowserTimezone(): string | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone || null;
  } catch {
    return null;
  }
}

/**
 * Formats an ISO instant in a specific IANA timezone. Falls back to the raw
 * ISO string if the timezone is invalid rather than throwing, since this
 * renders user- and university-entered timezone strings we don't validate
 * against the full IANA database.
 */
export function formatInstantInZone(
  isoInstant: string,
  timeZone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
      new Date(isoInstant),
    );
  } catch {
    return new Date(isoInstant).toISOString();
  }
}

export function zonesDiffer(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a !== b;
}
