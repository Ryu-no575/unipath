"use client";

import { Capacitor } from "@capacitor/core";

export type AppPlatform = "web" | "ios" | "android";

/**
 * Single source of truth for "are we running inside the Capacitor native
 * shell, and on which OS". Every other mobile-specific check in the app
 * (safe-area handling, native bottom nav, back-button, external links,
 * splash/status bar) should import from here instead of calling
 * `Capacitor.isNativePlatform()` / `Capacitor.getPlatform()` directly, so the
 * detection logic only has to be right in one place.
 */
export function getPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === "ios" || platform === "android") return platform;
  return "web";
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isIOS(): boolean {
  return getPlatform() === "ios";
}

export function isAndroid(): boolean {
  return getPlatform() === "android";
}

export function isWeb(): boolean {
  return getPlatform() === "web";
}
