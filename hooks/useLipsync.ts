"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeViseme, type Viseme } from "@/components/character/visemes";

/**
 * Wrap wawa-lipsync so the component consumes {viseme, gain}.
 *
 * Important quirk: wawa-lipsync@0.0.2's connectAudio ASSIGNS `audioSource = el`
 * before it checks that `el.src` is set — if src is empty, it returns without
 * calling createMediaElementSource, and subsequent calls short-circuit on
 * `audioSource === el`. That leaves the analyser (and the
 * analyser→audioContext.destination chain) never wired, so audio plays *muted*.
 *
 * To avoid that, we only call connectAudio once the element has a src. We
 * observe src via a tiny polling loop (MutationObserver doesn't cover the
 * `src` property setter). We also keep the RAF analysis loop gated on
 * `enabled` so we don't churn when nothing is playing.
 */

type LipLike = {
  connectAudio: (el: HTMLMediaElement) => void;
  processAudio: () => void;
  viseme: string;
  features: { volume?: number } | null;
};

const instanceCache = new WeakMap<HTMLMediaElement, LipLike>();
const connectedCache = new WeakSet<HTMLMediaElement>();

async function ensureConnected(audioEl: HTMLMediaElement): Promise<LipLike | null> {
  if (!audioEl.src) return null;

  const cached = instanceCache.get(audioEl);
  if (cached) {
    if (!connectedCache.has(audioEl)) {
      try {
        cached.connectAudio(audioEl);
        connectedCache.add(audioEl);
      } catch (err) {
        console.warn("[lipsync] connectAudio retry failed:", err);
      }
    }
    return cached;
  }

  try {
    const mod = await import("wawa-lipsync");
    const Ctor = mod.Lipsync;
    if (!Ctor) return null;
    const lip = new Ctor() as unknown as LipLike;
    lip.connectAudio(audioEl);
    instanceCache.set(audioEl, lip);
    connectedCache.add(audioEl);
    return lip;
  } catch (err) {
    console.warn("[lipsync] init failed:", err);
    return null;
  }
}

export function useLipsync(audioEl: HTMLAudioElement | null, enabled: boolean) {
  const [viseme, setViseme] = useState<Viseme>("sil");
  const [gain, setGain] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Eagerly wire analyser graph as soon as the element has a src, regardless of
  // `enabled`. This fixes wawa-lipsync's empty-src poisoning of `audioSource`.
  useEffect(() => {
    if (!audioEl) return;
    let cancelled = false;
    let pollId: number | null = null;

    const tryConnect = () => {
      if (cancelled) return;
      if (!audioEl.src) {
        pollId = window.setTimeout(tryConnect, 120);
        return;
      }
      ensureConnected(audioEl);
    };
    tryConnect();

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearTimeout(pollId);
    };
  }, [audioEl]);

  useEffect(() => {
    if (!audioEl || !enabled) return;
    let cancelled = false;

    (async () => {
      const lip = await ensureConnected(audioEl);
      if (!lip || cancelled) return;

      const tick = () => {
        try {
          lip.processAudio();
          setViseme(normalizeViseme(lip.viseme));
          const v = lip.features?.volume ?? 0;
          setGain(Math.min(1, Math.max(0, v)));
        } catch {
          setViseme("sil");
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setViseme("sil");
      setGain(0);
    };
  }, [audioEl, enabled]);

  return { viseme, gain };
}
