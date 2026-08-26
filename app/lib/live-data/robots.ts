import "server-only";

const ROBOTS_FETCH_TIMEOUT_MS = 5000;
const OUR_USER_AGENT = "UniPathBot";

/**
 * Minimal robots.txt check: does any `Disallow` rule under a matching
 * `User-agent` (our bot, or `*`) block this exact path? This is a
 * best-effort courtesy check, not a full parser (no wildcard/`$`/crawl-delay
 * support) -- sufficient for "don't fetch a page the site has explicitly
 * disallowed" without building a general-purpose robots.txt engine for a v1
 * that isn't crawling at scale yet. If robots.txt can't be fetched at all,
 * we proceed rather than block a legitimate check on that.
 */
export async function isAllowedByRobots(targetUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return false;
  }

  let robotsText: string;
  try {
    const response = await fetch(new URL("/robots.txt", url.origin), {
      headers: { "User-Agent": OUR_USER_AGENT },
      signal: AbortSignal.timeout(ROBOTS_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return true;
    robotsText = await response.text();
  } catch {
    return true;
  }

  const disallowedPaths = parseDisallowRules(robotsText, OUR_USER_AGENT);
  return !disallowedPaths.some((path) => url.pathname.startsWith(path));
}

function parseDisallowRules(robotsText: string, userAgent: string): string[] {
  const lines = robotsText.split("\n").map((line) => line.trim());
  const groups: { agents: string[]; disallows: string[] }[] = [];
  let current: { agents: string[]; disallows: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const [directive, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const key = directive.trim().toLowerCase();

    if (key === "user-agent") {
      if (!current || current.disallows.length > 0) {
        current = { agents: [], disallows: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current) {
      if (value) current.disallows.push(value);
    }
  }

  const applicable = groups.filter(
    (g) => g.agents.includes(userAgent.toLowerCase()) || g.agents.includes("*"),
  );
  const specific = applicable.filter((g) => g.agents.includes(userAgent.toLowerCase()));
  const chosen = specific.length > 0 ? specific : applicable;

  return chosen.flatMap((g) => g.disallows);
}
