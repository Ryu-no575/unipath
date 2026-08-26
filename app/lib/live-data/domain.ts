/**
 * Best-effort "same official domain" check for Source Validation (see
 * AGENTS.md task notes: a source must resolve onto the university's own
 * domain, not just return 200 -- otherwise a hijacked redirect or a stale
 * URL that now resolves to an unrelated site would still count as valid).
 *
 * Not a full Public Suffix List implementation (no dependency added for
 * this v1) -- just the second-level-domain patterns that actually show up
 * for universities worldwide (.ac.uk, .edu.au, .ac.jp, ...). Falls back to
 * comparing the last two labels, which is correct for the common case
 * (polimi.it, tudelft.nl, mit.edu).
 */
const KNOWN_TWO_LABEL_SUFFIXES = new Set([
  "ac.uk", "co.uk", "org.uk", "gov.uk", "sch.uk",
  "ac.jp", "ed.jp", "go.jp",
  "ac.kr", "or.kr", "go.kr",
  "edu.au", "gov.au", "org.au", "asn.au",
  "edu.sg", "gov.sg",
  "edu.cn", "gov.cn", "org.cn",
  "edu.hk", "gov.hk", "org.hk",
  "edu.tw", "gov.tw", "org.tw",
  "ac.nz", "govt.nz", "org.nz",
  "edu.in", "gov.in", "ac.in",
  "edu.my", "gov.my",
  "ac.th", "go.th",
  "edu.ph", "gov.ph",
  "ac.za", "gov.za", "org.za",
  "edu.br", "gov.br",
  "ac.ir",
  "edu.pk",
  "ac.be",
  "ac.at",
]);

export function getRegistrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const labels = host.split(".");
  if (labels.length <= 2) return host;

  const lastTwo = labels.slice(-2).join(".");
  if (KNOWN_TWO_LABEL_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}

export function isSameOfficialDomain(candidateUrl: string, officialWebsiteUrl: string): boolean {
  try {
    const candidateDomain = getRegistrableDomain(new URL(candidateUrl).hostname);
    const officialDomain = getRegistrableDomain(new URL(officialWebsiteUrl).hostname);
    return candidateDomain === officialDomain;
  } catch {
    return false;
  }
}
