"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Network } from "@capacitor/network";

/**
 * Phase 14: we never pretend UniPath works offline, and we never let a
 * stale cached screen look like current official information. This just
 * surfaces connectivity loss with a plain, honest banner -- no offline
 * caching of admissions/visa data is introduced here or anywhere else.
 *
 * Uses @capacitor/network (works identically in the native shell and on
 * web, since the plugin falls back to the browser's online/offline events
 * there) rather than `navigator.onLine` directly, so this is correct inside
 * the Capacitor WebView too.
 */
export default function NetworkStatusBanner() {
  const t = useTranslations("Offline");
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Network.getStatus().then((status) => {
      if (!cancelled) setOffline(!status.connected);
    });

    const listener = Network.addListener("networkStatusChange", (status) => {
      setOffline(!status.connected);
    });

    return () => {
      cancelled = true;
      listener.then((l) => l.remove());
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="w-full bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900"
      style={{ paddingTop: "calc(0.5rem + var(--safe-top))" }}
    >
      {t("message")}
    </div>
  );
}
