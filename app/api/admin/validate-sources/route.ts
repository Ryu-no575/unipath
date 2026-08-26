import { NextRequest, NextResponse } from "next/server";
import { hasServiceRoleEnv } from "@/app/lib/supabase/admin";
import { runDueValidations } from "@/app/lib/live-data/scheduler";

const MAX_LIMIT = 100;

/**
 * Runs a batch of due Source Validation checks (see
 * app/lib/live-data/scheduler.ts). This is the hook a real scheduler
 * (platform cron, an external scheduled job) attaches to for Phase 1 item 6
 * "Scheduled source validation" -- v1 doesn't run one itself, but the
 * endpoint already exists so wiring one up later is just "call this on a
 * timer", not new code.
 *
 * Gated two ways: always allowed outside production (same convention as
 * /admin, for manual triggering during development), and in production only
 * when the caller presents SOURCE_VALIDATION_CRON_SECRET as a Bearer token
 * -- unset by default, so this route is simply disabled in production until
 * an operator deliberately configures a scheduler for it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 500 });
  }

  if (process.env.NODE_ENV === "production") {
    const secret = process.env.SOURCE_VALIDATION_CRON_SECRET;
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : 20;

  const summary = await runDueValidations(limit);
  return NextResponse.json(summary);
}
