"use client";

import { useEffect } from "react";
import { useKiosk } from "@/lib/store";

/**
 * After `timeoutMs` of no user interaction, push the kiosk into "attract"
 * mode. Any touch resets it back to idle. Only runs when in idle/attract —
 * during listening/speaking we never want to interrupt the flow.
 */
export function useIdleTimer(timeoutMs: number = 40_000) {
  useEffect(() => {
    let timer: number | null = null;
    const arm = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const s = useKiosk.getState();
        if (s.phase === "idle") s.setPhase("attract");
      }, timeoutMs);
    };

    const resetToIdle = () => {
      const s = useKiosk.getState();
      if (s.phase === "attract") s.setPhase("idle");
      s.markInteraction();
      arm();
    };

    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "touchstart",
      "keydown",
    ];
    events.forEach((e) => window.addEventListener(e, resetToIdle, { passive: true }));
    arm();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetToIdle));
    };
  }, [timeoutMs]);
}
