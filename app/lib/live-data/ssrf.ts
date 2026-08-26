import "server-only";

/**
 * Best-effort SSRF guard for outbound checkSource() fetches. This is only
 * ever called with a URL already stored in the `sources` table (never a
 * client-supplied one -- see app/lib/live-data/checkSource.ts) but a
 * compromised or careless `sources.official_url` value must still not be
 * able to reach internal infrastructure.
 *
 * Hostname-based, not DNS-resolution-based: good enough for the "official
 * URLs only, no arbitrary fetch" requirement of this v1 foundation. A
 * production crawler should additionally validate the resolved IP (and
 * ideally run through an egress proxy) since DNS rebinding can defeat a
 * hostname-only check.
 */
const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".internal", ".localhost"];
const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::1"]);

function isPrivateIPv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 127) return true; // loopback
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0) return true;
  return false;
}

const MAX_REDIRECTS = 5;

export interface SafeFetchResult {
  response: Response;
  /** The URL the response actually came from, after following any
   * redirects -- equal to the input `url` when there were none. Source
   * Validation (validateSource.ts) needs this to detect "the university
   * moved this page" (301/302 to a new final URL) vs. "this exact URL still
   * works", and to record `sources.resolved_url`. */
  finalUrl: string;
  redirected: boolean;
  hops: number;
}

/**
 * Fetches `url` following redirects manually (never `redirect: "follow"`) so
 * every hop -- not just the initial, already-vetted `sources.official_url`
 * -- is re-validated against isSafeSourceUrl before being requested. Without
 * this, a source that starts safe could redirect (now or after being
 * compromised) to an internal address and `fetch` would happily follow it.
 */
export async function safeFetchWithMeta(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<SafeFetchResult> {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafeSourceUrl(currentUrl)) {
      throw new Error(`Refusing to fetch unsafe URL${hop > 0 ? " after redirect" : ""}: ${currentUrl}`);
    }
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: currentUrl, redirected: hop > 0, hops: hop };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return { response, finalUrl: currentUrl, redirected: hop > 0, hops: hop };
  }
  throw new Error(`Too many redirects (>${MAX_REDIRECTS}) while fetching ${url}`);
}

export function isSafeSourceUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) return false;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;
  if (hostname.startsWith("fc") || hostname.startsWith("fd") || hostname === "::1") {
    // Coarse unique-local-address (fc00::/7) check for IPv6 literals.
    if (/^\[?f[cd][0-9a-f]{2}:/i.test(hostname)) return false;
  }
  if (isPrivateIPv4(hostname)) return false;

  return true;
}
