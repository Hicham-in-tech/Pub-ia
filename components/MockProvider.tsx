"use client";

import { useEffect, useState } from "react";

/**
 * When NEXT_PUBLIC_USE_MOCKS=true, register the MSW service worker before
 * rendering children. This makes /api/chat resolve offline for UI polish work
 * on the plane, on the kiosk staging table, wherever.
 */
export function MockProvider({ children }: { children: React.ReactNode }) {
  const enabled = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const { worker } = await import("@/lib/mocks/browser");
      await worker.start({ onUnhandledRequest: "bypass" });
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!ready) return null;
  return <>{children}</>;
}
