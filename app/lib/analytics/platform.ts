"use client";

import { getPlatform } from "@/app/lib/platform";

/**
 * Phase 13 prep: a single place to tag analytics events with which shell
 * they came from, for whenever native-specific analytics differences
 * actually show up (e.g. a native-only funnel step). Not wired into
 * anything yet -- Vercel Analytics (`<Analytics />` in the root layout)
 * keeps working unmodified on web and inside the Capacitor shell alike,
 * since it's just a client-side fetch to Vercel's collector over HTTPS.
 *
 * Never combine this with anything from a user's profile -- see
 * app/lib/analytics/track.ts's existing PII rules, which this must keep
 * following: no email, no profile fields, no test scores, no passport or
 * document data, ever, in an analytics `properties` payload.
 */
export function getAnalyticsPlatformTag(): "web" | "ios" | "android" {
  return getPlatform();
}
