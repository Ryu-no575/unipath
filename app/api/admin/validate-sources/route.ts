import { NextRequest, NextResponse } from "next/server";
import { hasServiceRoleEnv } from "@/app/lib/supabase/admin";
import { requireAdmin } from "@/app/lib/supabase/roles";
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
 * Two ways in: an authenticated admin (task brief item 27 -- re-checked
 * server-side via requireAdmin(), same as every other admin action), or a
 * caller presenting SOURCE_VALIDATION_CRON_SECRET as a Bearer token for an
 * unattended scheduler -- unset by default, so the cron path is disabled
 * until an operator deliberately configures one. Outside production, either
 * check passing is enough; a signed-out request with no cron secret is still
 * rejected everywhere.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 500 });
  }

  const secret = process.env.SOURCE_VALIDATION_CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronAuthorized = Boolean(secret) && provided === secret;

  if (!cronAuthorized) {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : 20;

  const summary = await runDueValidations(limit);
  return NextResponse.json(summary);
}
