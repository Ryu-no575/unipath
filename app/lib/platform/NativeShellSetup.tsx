"use client";

import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useRouter } from "@/i18n/navigation";
import { isNativePlatform } from "@/app/lib/platform";

/**
 * Single native-shell bootstrap, mounted once in the root layout. Everything
 * Capacitor needs at startup lives here so the rest of the app never has to
 * think about it:
 *
 *  - tags <html data-platform="native"|"web"> for CSS (see globals.css) and
 *    any component that needs a non-hook platform check post-hydration.
 *  - hides the splash screen once the first paint has happened.
 *  - sets the status bar style (no-op, and safe to call, on web).
 *  - Android hardware back button: close an open modal/drawer first (an app
 *    screen dispatches `unipath:closeTopOverlay` when it has one open, e.g.
 *    Modal.tsx), else fall back to browser history, else let the OS decide
 *    (minimizes the app at the navigation root instead of exiting -- the
 *    default behavior when no listener calls `event.preventDefault()` via
 *    canGoBack being false is handled by Capacitor itself).
 *  - deep links (unipath://... and https://unipath-dun.vercel.app/...):
 *    hands the path straight to next-intl's router, so locale routing,
 *    proxy.ts auth gating, etc. all run exactly as they would for an
 *    in-app link click.
 *  - external links (Phase 11): every official/external source link in the
 *    app already renders as `<a target="_blank" rel="noopener ...">`
 *    (OfficialSourceLink, RealMatchCard, RouteStepNode, university pages,
 *    etc. -- ~20 call sites). Rather than teach each of them about
 *    Capacitor, this single delegated click handler intercepts exactly
 *    that one attribute pattern and routes it through Capacitor's Browser
 *    plugin (SFSafariViewController / Chrome Custom Tabs) instead, which
 *    keeps a real address bar visible for source transparency. A bare
 *    `target="_blank"` inside a WebView otherwise silently no-ops on
 *    iOS/Android, so this also fixes a real bug, not just a UX nicety.
 *    Internal `<Link>`s (no target="_blank") are untouched and keep
 *    navigating inside the WebView as normal.
 *
 * Renders nothing.
 */
export default function NativeShellSetup() {
  const router = useRouter();

  useEffect(() => {
    const native = isNativePlatform();
    document.documentElement.dataset.platform = native ? "native" : "web";
    if (!native) return;

    SplashScreen.hide().catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#ffffff" }).catch(() => {});

    const backListener = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      // dispatchEvent returns false when a listener called preventDefault()
      // -- i.e. an open Modal handled the back press itself by closing.
      const notHandledByOverlay = window.dispatchEvent(
        new CustomEvent("unipath:hardwareBack", { cancelable: true }),
      );
      if (!notHandledByOverlay) return;

      if (canGoBack) {
        window.history.back();
      } else {
        CapacitorApp.minimizeApp().catch(() => {});
      }
    });

    function handleExternalLinkClick(event: MouseEvent) {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[target=\"_blank\"]");
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;
      event.preventDefault();
      Browser.open({ url: anchor.href }).catch(() => {
        window.open(anchor.href, "_blank", "noopener,noreferrer");
      });
    }
    document.addEventListener("click", handleExternalLinkClick);

    const urlListener = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        // Accept both the custom scheme (unipath://match) and universal
        // links (https://unipath-dun.vercel.app/en/match) -- both resolve
        // to the same in-app path.
        const path = parsed.protocol === "unipath:" ? parsed.pathname || `/${parsed.hostname}` : parsed.pathname;
        if (path) router.push(`${path}${parsed.search}`);
      } catch {
        // Malformed deep link -- ignore rather than crash the app.
      }
    });

    return () => {
      document.removeEventListener("click", handleExternalLinkClick);
      backListener.then((l) => l.remove());
      urlListener.then((l) => l.remove());
    };
  }, [router]);

  return null;
}
