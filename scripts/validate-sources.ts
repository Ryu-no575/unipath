// Real University Data -- Source Validation CLI (task brief item 33:
// `npm run validate:sources`, kept as a separate process from
// `npm run sync:universities`).
//
// Deliberately a thin HTTP client, not a standalone re-implementation of
// app/lib/live-data/validateSource.ts: that pipeline is SSRF-guarded and
// robots.txt-respecting (see ssrf.ts/robots.ts), and those modules -- like
// this whole module tree -- import "server-only", which only resolves
// inside Next's webpack build (see scripts/import-universities.ts's own
// note on the same constraint). Duplicating security-sensitive fetch logic
// into a second, unguarded copy just to make it run under plain `node`
// would be worse than requiring the app to be running. This script instead
// calls the same POST /api/admin/validate-sources route the Admin page's
// "Validate sources" button already uses.
//
// Usage (run `npm run dev` or point APP_URL at a deployed instance first):
//   npm run validate:sources
//   npm run validate:sources -- --limit=50
//   APP_URL=https://your-deployment npm run validate:sources

function parseLimit(argv: string[]): number | null {
  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

async function main() {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const limit = parseLimit(process.argv.slice(2));
  const url = new URL("/api/admin/validate-sources", baseUrl);
  if (limit != null) url.searchParams.set("limit", String(limit));

  console.log(`Requesting ${url.toString()} ...`);
  console.log("(requires the app to be running -- `npm run dev` in another terminal, or APP_URL=<deployment>)");

  let response: Response;
  try {
    response = await fetch(url, { method: "POST" });
  } catch (err) {
    console.error(`Could not reach ${baseUrl}. Is the app running? (${err instanceof Error ? err.message : String(err)})`);
    process.exit(1);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`HTTP ${response.status}:`, body ?? (await response.text().catch(() => "")));
    process.exit(1);
  }

  console.log("");
  console.log(JSON.stringify(body, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
