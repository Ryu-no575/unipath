# UniPath Mobile App (Capacitor)

UniPath ships as **Web + iOS + Android from one Next.js codebase**. This document
covers the mobile architecture on top of the existing app — read
`AGENTS.md`/`CLAUDE.md` first for the base Next.js project rules.

## 1. Architecture

UniPath's Next.js app is server-heavy: `proxy.ts` (Next 16's renamed
`middleware.ts`) refreshes the Supabase session and runs next-intl locale
routing on *every* request, most pages are Server Components, mutations go
through Server Actions, and auth is cookie-based SSR (`@supabase/ssr`). None
of that survives `next build && next export` — Server Components, Server
Actions, `proxy.ts`, and next-intl's server-side routing are all explicitly
[unsupported in a static export](https://nextjs.org/docs/app/guides/static-exports#unsupported-features).

So instead of bundling a static export into the native app, **the iOS and
Android shells load the live production HTTPS deployment directly**, the
same way a Trusted Web Activity / installed PWA wraps a real website:

- `capacitor.config.ts` sets `server.url` to the production URL
  (`https://unipath-dun.vercel.app`). Capacitor points the native WebView at
  that URL instead of local bundled files.
- `mobile/www/index.html` is a placeholder `webDir` (Capacitor's CLI
  requires one to exist). It is **not** the app — it's a one-screen "check
  your connection" fallback that only a user could ever see if the WebView
  fails to reach the remote URL at all. It has no other role.
- Every Supabase auth cookie, `proxy.ts` redirect, Server Action, and
  next-intl locale route behaves *exactly* as it does in mobile Safari/Chrome,
  because it genuinely is the same HTTPS origin, not a re-implementation.

**Trade-off to know:** the app requires network connectivity to load past the
placeholder screen — there is no true offline mode (see §14/Offline below,
this is intentional, not a bug).

## 2. How Web/Vercel remains deployed

Nothing about the Vercel deployment changed. `next build`, `next start`,
`proxy.ts`, all routes, and all env vars work exactly as before. The
Capacitor packages added to `package.json` (`@capacitor/*`) are plain npm
dependencies that Vercel's build simply ignores — nothing in `next.config.ts`
or the app code branches on their presence. The web app has zero new runtime
behavior *except*:

- `app/lib/platform/*` and `NativeShellSetup` no-op safely on web
  (`Capacitor.getPlatform()` returns `"web"` there).
- The root layout now sets `viewportFit: "cover"`, which only changes
  rendering on devices with a notch/Dynamic Island in fullscreen contexts —
  harmless in a normal browser tab.
- `<NetworkStatusBanner />` now renders on web too (a plain offline banner
  using the browser's online/offline events) — this is a deliberate, low-risk
  addition to every surface, not native-only.

## 3. How Capacitor wraps UniPath

- `capacitor.config.ts` — app id `com.unipath.app`, app name `UniPath`,
  `webDir: "mobile/www"`, `server.url` pointing at production.
- `ios/` and `android/` — generated native projects (`npx cap add ios/android`).
  These directories **are committed to git** (standard Capacitor convention);
  only build artifacts (`Pods/`, `build/`, `.gradle/`, etc.) are gitignored.
- `app/lib/platform/index.ts` — the single place that calls
  `Capacitor.getPlatform()` / `isNativePlatform()`. Nothing else in the app
  should call the Capacitor API directly for platform checks.
- `app/lib/platform/NativeShellSetup.tsx` — mounted once in
  `app/[locale]/layout.tsx` (inside `NextIntlClientProvider`, since it uses
  next-intl's `useRouter`). Renders nothing; on native it:
  - tags `<html data-platform="native">` for CSS hooks (see `globals.css`)
  - hides the splash screen and sets the status bar style/color
  - handles the Android hardware back button (§10)
  - handles deep links via `appUrlOpen` (§9)
  - intercepts `<a target="_blank">` clicks and opens them via
    `@capacitor/browser` instead of the WebView's browser (§11)
- `app/lib/platform/useKeyboardOpen.ts` — `visualViewport`-based hook used by
  `NavShell` to hide the bottom nav while the on-screen keyboard is open.

## 4. Android development instructions

Requires: Android Studio (bundles the Android SDK) and a JDK (Android Studio
ships one). Not installed/verified on this Windows dev machine as part of
this change — see §16.

```bash
npm run build          # produce the Next.js build (Vercel deploy target)
npm run mobile:sync    # copy capacitor.config.ts + plugin list into android/
npm run mobile:android # sync + open android/ in Android Studio
```

From Android Studio: connect a device or start an emulator, then Run. The
app will load `https://unipath-dun.vercel.app` directly — you do not need to
run `next dev` locally to see the app in the emulator (though you can point
`server.url` at `http://10.0.2.2:3000` temporarily for local dev; see §8).

## 5. iOS development instructions

Requires **macOS + Xcode** — this cannot be built or run on Windows. This
repo has never had `pod install` / `xcodebuild` run against it; the `ios/`
project has only been generated and synced, not compiled.

On a Mac:

```bash
npm run build
npm run mobile:sync
npm run mobile:ios     # sync + open ios/App/App.xcworkspace... (opens ios/ in Xcode)
```

In Xcode: select a Team under Signing & Capabilities (needed even for
Simulator on newer Xcode versions), pick a Simulator or device, then Run.

## 6. iOS compilation / store submission requirement

**Final iOS compilation and App Store submission require macOS + Xcode.**
This project was audited and configured entirely on Windows; nothing here
claims to have been run in Xcode or the iOS Simulator. Before submitting:
CocoaPods/SPM resolution, code signing with a real Apple Developer Team, and
Associated Domains (Universal Links, §9) all need to happen on a Mac.

## 7. How to sync after web changes

Because the native shells load the **live production URL**, most web changes
need *no* native sync at all — ship to Vercel, and the next time the app
opens (or pulls to refresh) it's already current, exactly like a website.

You only need `npm run mobile:sync` (or `mobile:ios` / `mobile:android`)
when you change:

- `capacitor.config.ts` (e.g. a different production URL, new plugin config)
- installed Capacitor plugins
- native project files under `ios/` or `android/` directly

## 8. Environment variable rules

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are the
  only Supabase variables ever readable client-side (see `.env.example`) —
  this is unchanged by Capacitor, and nothing in the mobile layer reads or
  needs Supabase env vars directly, since the app is loaded from the live
  deployment, which already has them configured on Vercel.
- **`SUPABASE_SERVICE_ROLE_KEY` must never reach a client bundle.** It
  already only appears in `app/lib/supabase/admin.ts`, Server Actions, and
  one API route (`app/api/admin/validate-sources`) — verified during this
  change (grep audit, see PR/commit description). Nothing about Capacitor
  changes this; do not add it to `capacitor.config.ts` or any client file.
- To point the native shell at a different environment (e.g. a staging
  deployment, or your local `next dev` server for testing — use your
  machine's LAN IP or `10.0.2.2` for the Android emulator, `localhost` works
  for iOS Simulator), edit `PRODUCTION_URL` in `capacitor.config.ts` and
  re-run `npm run mobile:sync`. Do not commit a non-production URL.

## 9. Deep link architecture

Two ways into the app, both handled by `NativeShellSetup`'s `appUrlOpen`
listener, which hands the path to next-intl's router (so `proxy.ts` auth
gating and locale routing run normally):

- **Custom scheme** — `unipath://match`, `unipath://university/123`,
  `unipath://route/fastest`, `unipath://visa`. Registered in
  `ios/App/App/Info.plist` (`CFBundleURLTypes`) and
  `android/app/src/main/AndroidManifest.xml` (an `android:scheme="unipath"`
  intent filter). Works today — no external verification needed.
- **Universal / App Links** — `https://unipath-dun.vercel.app/...` opening
  directly in the app instead of a browser. The Android intent filter is
  already declared but **`autoVerify` is intentionally left off**, and iOS
  Associated Domains is **not yet configured**, because both require a real
  release signing identity that doesn't exist yet:
  - **Android**: once you have a release keystore, publish
    `https://unipath-dun.vercel.app/.well-known/assetlinks.json` with that
    key's SHA-256 fingerprint, then add `android:autoVerify="true"` to the
    https intent filter in `AndroidManifest.xml`.
  - **iOS**: in Xcode (macOS required), add the "Associated Domains"
    capability with `applinks:unipath-dun.vercel.app`, then publish
    `https://unipath-dun.vercel.app/.well-known/apple-app-site-association`.

## 10. Store-release checklist

- [ ] Replace placeholder app icons — `android/app/src/main/res/mipmap-*` and
      `ios/App/App/Assets.xcassets/AppIcon.appiconset` currently hold
      Capacitor's generic default icon, **not** UniPath branding. Once real
      1024×1024 source artwork exists, regenerate with `@capacitor/assets`.
- [ ] Replace placeholder splash screen — same default-template situation,
      `android/app/src/main/res/drawable*/splash.png`.
- [ ] Confirm `PRODUCTION_URL` in `capacitor.config.ts` is the final
      production domain (custom domain vs. `unipath-dun.vercel.app`).
- [ ] Android: generate a release keystore, configure signing in
      `android/app/build.gradle`, publish `assetlinks.json`, flip
      `autoVerify="true"` (§9).
- [ ] iOS: enroll in the Apple Developer Program, configure signing in
      Xcode, add Associated Domains + publish `apple-app-site-association`
      (§9), build/test in Xcode and on a physical device (never done on this
      Windows machine).
- [ ] Write store listing copy, screenshots (device sizes per store
      requirements), and privacy nutrition labels (App Store) / Data safety
      form (Play Console) — reflecting exactly what the app does (Supabase
      auth, no analytics beyond Vercel Analytics' anonymous metrics, no
      sensitive-field tracking, see §13 in the implementation notes below).
- [ ] Test Apple Sign In / Google Sign In / OAuth deep links if/when added
      (see "Auth" below — not implemented yet).
- [ ] Run the app on real low-end Android hardware and an older iPhone, not
      just simulators/emulators, before submitting.

## 11. Known limitations

- **No offline mode.** The app requires network connectivity to load past
  `mobile/www/index.html`'s placeholder screen. `NetworkStatusBanner`
  surfaces connectivity loss but nothing is cached for offline reading —
  intentional, since presenting stale visa/admissions data as current would
  be actively misleading.
- **Universal Links / App Links are not verified yet** — see §9. Until then,
  `https://unipath-dun.vercel.app/...` links from other apps will prompt an
  Android disambiguation dialog (browser vs. UniPath) rather than opening
  UniPath directly, and won't deep-link on iOS at all (they'll just open in
  Safari, which itself works fine — it just isn't "in-app").
  `unipath://...` custom-scheme links work today on both platforms.
  Also note: `appUrlOpen` fires only while the app process is alive/resuming
  — a cold start from a deep link is handled the same way by Capacitor, but
  hasn't been device-tested (no Xcode/Android Studio on this machine).
- **Apple/Google Sign-In are not implemented**, only prepared for: the
  `appUrlOpen` listener that would catch an OAuth redirect already exists,
  but there's no `/auth/callback` route or `signInWithOAuth` call yet, and
  adding real Sign In with Apple requires an Apple Developer Team + capability
  configuration in Xcode that can't be done from Windows.
- **App icons/splash are Capacitor's generic defaults**, clearly not final
  branding — see the store-release checklist.
- **iOS has never been built or run** — no Xcode on this machine. Android has
  been synced (`npx cap sync`) but not compiled with Gradle — no JDK/Android
  SDK on this machine either (see Build Verification in the PR description).
- **File uploads** (Passport documents) rely on the plain HTML
  `<input type="file">` picker, which both WKWebView and Android's WebView
  already route to the native file/photo picker without any Capacitor
  plugin. No `@capacitor/filesystem`/`@capacitor/camera` integration was
  added, since the existing upload flow (Server Action + Supabase) already
  works as-is and no new document-storage behavior was in scope for this
  change.
