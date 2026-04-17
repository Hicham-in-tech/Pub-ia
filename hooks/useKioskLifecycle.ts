"use client";

import { useEffect } from "react";

/**
 * Hardens the page against casual touchscreen abuse:
 * pinch-zoom, context menus, pull-to-refresh overscroll, text drag selection,
 * accidental tab-close (beforeunload confirmation).
 *
 * Can be disabled with NEXT_PUBLIC_DISABLE_KIOSK_GUARDS=true for dev.
 */
export function useKioskLifecycle() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_KIOSK_GUARDS === "true") return;

    const preventContext = (e: Event) => e.preventDefault();
    const preventGesture = (e: Event) => e.preventDefault();
    const preventPinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const preventKeyZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) {
        e.preventDefault();
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("contextmenu", preventContext);
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);
    document.addEventListener("touchmove", preventPinch, { passive: false });
    document.addEventListener("wheel", preventWheelZoom, { passive: false });
    document.addEventListener("keydown", preventKeyZoom);
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      document.removeEventListener("contextmenu", preventContext);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchmove", preventPinch);
      document.removeEventListener("wheel", preventWheelZoom);
      document.removeEventListener("keydown", preventKeyZoom);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);
}
