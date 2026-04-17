"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CANDIDATE_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of CANDIDATE_MIMES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

export type RecorderState = "idle" | "starting" | "recording" | "stopping";

type UseRecorderResult = {
  state: RecorderState;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
  level: number;
  error: string | null;
  hasPermission: boolean | null;
};

/**
 * Grabs the mic, records audio, exposes live RMS for the listening ring, and
 * auto-stops on sustained silence.
 *
 * - maxMs hard cap so a user who walks away doesn't block the session
 * - silenceMs of sustained below-threshold RMS triggers stop
 */
export function useRecorder(opts?: {
  silenceMs?: number;
  silenceThreshold?: number;
  maxMs?: number;
  onAutoStop?: () => void;
}): UseRecorderResult {
  const silenceMs = opts?.silenceMs ?? 1500;
  const silenceThreshold = opts?.silenceThreshold ?? 0.04;
  const maxMs = opts?.maxMs ?? 12_000;

  const [state, setState] = useState<RecorderState>("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceAtRef = useRef<number | null>(null);
  const startAtRef = useRef<number>(0);
  const autoStopFiredRef = useRef<boolean>(false);
  const stopResolverRef = useRef<((b: Blob | null) => void) | null>(null);
  const onAutoStopRef = useRef(opts?.onAutoStop);
  onAutoStopRef.current = opts?.onAutoStop;

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    acRef.current?.close().catch(() => {});
    acRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  };

  const start = useCallback(async () => {
    setError(null);
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      setHasPermission(true);

      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = mr;
      chunksRef.current = [];

      mr.addEventListener("dataavailable", (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });

      mr.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, {
          type: mime ?? "audio/webm",
        });
        setState("idle");
        setLevel(0);
        cleanup();
        stopResolverRef.current?.(blob);
        stopResolverRef.current = null;
      });

      // RMS analyser for the listening ring and silence detection
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) throw new Error("AudioContext unavailable");
      const ac = new AC();
      acRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Float32Array(analyser.fftSize);
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += (buf[i] ?? 0) ** 2;
        const rms = Math.sqrt(sum / buf.length);
        // EMA so the meter doesn't jitter
        setLevel((prev) => prev * 0.7 + rms * 0.3);

        const now = performance.now();
        if (rms < silenceThreshold) {
          silenceAtRef.current = silenceAtRef.current ?? now;
          if (now - silenceAtRef.current >= silenceMs && !autoStopFiredRef.current) {
            autoStopFiredRef.current = true;
            onAutoStopRef.current?.();
          }
        } else {
          silenceAtRef.current = null;
        }

        if (now - startAtRef.current >= maxMs && !autoStopFiredRef.current) {
          autoStopFiredRef.current = true;
          onAutoStopRef.current?.();
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      mr.start(100);
      startAtRef.current = performance.now();
      silenceAtRef.current = null;
      autoStopFiredRef.current = false;
      setState("recording");
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "mic failure";
      setError(msg);
      setHasPermission(false);
      setState("idle");
      cleanup();
      throw err;
    }
  }, [silenceMs, silenceThreshold, maxMs]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    const mr = recRef.current;
    if (!mr || mr.state === "inactive") return null;
    setState("stopping");
    return new Promise<Blob | null>((resolve) => {
      stopResolverRef.current = resolve;
      try {
        mr.stop();
      } catch {
        resolve(null);
      }
    });
  }, []);

  return { state, start, stop, level, error, hasPermission };
}
