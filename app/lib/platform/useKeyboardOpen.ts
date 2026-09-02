"use client";

import { useEffect, useState } from "react";

/**
 * True while the on-screen keyboard is (probably) covering part of the
 * viewport -- detected as a significant shrink in visualViewport height vs.
 * the layout viewport. Used to hide the fixed bottom nav / floating CTAs
 * while a text input has focus, so they don't float on top of the keyboard
 * or the input the user is typing into (Phase 5/8 requirement). Works the
 * same on mobile web and inside the Capacitor shell -- no platform check
 * needed, since both use the same visualViewport API.
 */
export function useKeyboardOpen(threshold = 150): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function handleResize() {
      if (!viewport) return;
      const shrink = window.innerHeight - viewport.height;
      setOpen(shrink > threshold);
    }

    viewport.addEventListener("resize", handleResize);
    handleResize();
    return () => viewport.removeEventListener("resize", handleResize);
  }, [threshold]);

  return open;
}
