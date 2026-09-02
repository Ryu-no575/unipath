import type { CapacitorConfig } from "@capacitor/cli";

/**
 * UniPath ships as Web (Vercel) + iOS + Android from this one Next.js
 * codebase. The Next.js app relies on proxy.ts (session refresh + locale
 * routing), Server Components, Server Actions, and cookie-based Supabase
 * SSR auth — none of which survive `next build && next export`. So instead
 * of bundling a static export, the native shells load the live production
 * HTTPS deployment directly (the same architecture as a Trusted Web
 * Activity/PWA wrapper). `webDir` below is only a placeholder fallback page
 * shown if the app is opened with no network before the remote URL loads;
 * see mobile/www/index.html. Full rationale: docs/MOBILE_APP.md.
 */
const PRODUCTION_URL = "https://unipath-dun.vercel.app";

const config: CapacitorConfig = {
  appId: "com.unipath.app",
  appName: "UniPath",
  webDir: "mobile/www",
  server: {
    url: PRODUCTION_URL,
    // The production deployment is already HTTPS; this just makes the
    // requirement explicit and prevents any accidental cleartext fallback.
    androidScheme: "https",
    cleartext: false,
  },
  ios: {
    // Matches the web app's own scroll containers; avoids WKWebView's
    // default rubber-banding fighting with sticky headers/bottom nav.
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      // Overlay off: the web app manages its own safe-area padding (see
      // app/lib/platform/safe-area), so the status bar should reserve its
      // own space rather than floating over content.
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#ffffff",
    },
  },
};

export default config;
