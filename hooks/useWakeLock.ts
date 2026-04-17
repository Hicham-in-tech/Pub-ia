"use client";

import { useEffect } from "react";

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (ev: "release", cb: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

/**
 * Request a screen wake lock and re-request on visibility change (browsers
 * drop it when the tab goes background, even for kiosk setups).
 */
export function useWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    const request = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
        sentinel.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        // ignore — not fatal
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible" && !sentinel) request();
    };

    request();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      sentinel?.release().catch(() => {});
    };
  }, []);
}
