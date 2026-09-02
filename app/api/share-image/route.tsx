import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { COUNTRY_CODES } from "@/app/lib/countries";
import { flagEmoji } from "@/app/lib/countryFlag";

const WIDTH = 1080;
const HEIGHT = 1920;
const MAX_LEN = 80;

function truncate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_LEN ? `${trimmed.slice(0, MAX_LEN - 1)}…` : trimmed;
}

function validCountry(code: string | null): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return (COUNTRY_CODES as readonly string[]).includes(upper) ? upper : null;
}

/**
 * "Share My UniPath" image generator (task brief section 7). Renders only
 * already-public, on-screen fields the caller passes explicitly through the
 * URL -- never reads a session, profile, or database. No email, legal name,
 * documents, passport data, or test scores are accepted as params at all, so
 * there is nothing privacy-sensitive this endpoint could leak even if misused.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const university = truncate(params.get("university"));
  if (!university) {
    return new Response("Missing required 'university' parameter", { status: 400 });
  }
  const program = truncate(params.get("program"));
  const year = truncate(params.get("year"));
  const origin = validCountry(params.get("origin"));
  const destination = validCountry(params.get("destination"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "96px 72px",
          background: "linear-gradient(160deg, #0b1220 0%, #10192c 55%, #05070d 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ color: "#c9a227", fontSize: 32, fontWeight: 700, letterSpacing: 6 }}>
            MY UNIPATH
          </span>

          {(origin || destination) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
              {origin && (
                <span style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 56, color: "#ffffff" }}>
                  <span>{flagEmoji(origin)}</span>
                </span>
              )}
              {origin && destination && (
                <span style={{ display: "flex", color: "#c9a227", fontSize: 40 }}>↓</span>
              )}
              {destination && (
                <span style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 56, color: "#ffffff" }}>
                  <span>{flagEmoji(destination)}</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <span
            style={{
              display: "flex",
              width: "fit-content",
              background: "#1d4ed8",
              color: "#ffffff",
              fontSize: 28,
              fontWeight: 700,
              padding: "10px 24px",
              borderRadius: 999,
            }}
          >
            #1 Match
          </span>
          <span style={{ display: "flex", color: "#ffffff", fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
            {university}
          </span>
          {(program || year) && (
            <span style={{ display: "flex", color: "#9fb0d0", fontSize: 36 }}>
              {[program, year].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>

        <span style={{ display: "flex", color: "#5a6b8c", fontSize: 28, fontWeight: 600 }}>
          Powered by UniPath
        </span>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
