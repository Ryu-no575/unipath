import { NextRequest, NextResponse } from "next/server";
import {
  mapRorItemToSearchResult,
  type RorSearchResponse,
} from "@/app/lib/ror";

const ROR_API_URL = "https://api.ror.org/v2/organizations";
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 12;
const REQUEST_TIMEOUT_MS = 8000;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: [] });
  }

  const upstreamUrl = new URL(ROR_API_URL);
  upstreamUrl.searchParams.set("query", query);
  upstreamUrl.searchParams.set("filter", "types:education");

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not connect to the ROR API. Please try again later." },
      { status: 502 },
    );
  }

  if (!upstreamResponse.ok) {
    return NextResponse.json(
      { error: "The university search service is temporarily unavailable." },
      { status: 502 },
    );
  }

  const data = (await upstreamResponse.json()) as RorSearchResponse;
  const results = (data.items ?? [])
    .slice(0, MAX_RESULTS)
    .map(mapRorItemToSearchResult);

  return NextResponse.json({ results });
}
