export interface RorName {
  value: string;
  lang: string | null;
  types: string[];
}

export interface RorLink {
  type: string;
  value: string;
}

export interface RorGeonamesDetails {
  name?: string;
  country_name?: string;
  country_code?: string;
}

export interface RorLocation {
  geonames_id?: number;
  geonames_details?: RorGeonamesDetails;
}

export interface RorItem {
  id: string;
  names: RorName[];
  types: string[];
  links: RorLink[];
  established: number | null;
  locations: RorLocation[];
}

export interface RorSearchResponse {
  number_of_results: number;
  items: RorItem[];
}

export interface UniversitySearchResult {
  rorId: string;
  name: string;
  country: string | null;
  /** ISO 3166-1 alpha-2, when ROR provides one — matches this app's country
   * select values (see app/lib/countries.ts), unlike `country` above which is
   * a display name. */
  countryCode: string | null;
  city: string | null;
  established: number | null;
  website: string | null;
}

function pickDisplayName(names: RorName[]): string {
  const display = names.find((entry) => entry.types.includes("ror_display"));
  if (display) return display.value;
  const label = names.find((entry) => entry.types.includes("label"));
  if (label) return label.value;
  return names[0]?.value ?? "Unknown institution";
}

function pickWebsite(links: RorLink[]): string | null {
  return links.find((link) => link.type === "website")?.value ?? null;
}

export function mapRorItemToSearchResult(item: RorItem): UniversitySearchResult {
  const location = item.locations?.[0]?.geonames_details;

  return {
    rorId: item.id,
    name: pickDisplayName(item.names ?? []),
    country: location?.country_name ?? null,
    countryCode: location?.country_code?.toUpperCase() ?? null,
    city: location?.name ?? null,
    established: item.established ?? null,
    website: pickWebsite(item.links ?? []),
  };
}
