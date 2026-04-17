"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackgroundFX } from "@/components/character/BackgroundFX";
import { Rouda } from "@/components/character/Rouda";
import { MicButton } from "@/components/input/MicButton";
import { TextDrawer } from "@/components/input/TextDrawer";
import { AttractLoop } from "@/components/ui/AttractLoop";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { TranscriptBubble } from "@/components/ui/TranscriptBubble";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { useKioskLifecycle } from "@/hooks/useKioskLifecycle";
import { useLipsync } from "@/hooks/useLipsync";
import { useRecorder } from "@/hooks/useRecorder";
import { useWakeLock } from "@/hooks/useWakeLock";
import { detectLang, type Lang } from "@/lib/lang";
import { useKiosk } from "@/lib/store";

type ChatResponse = {
  output: string;
  audioUrl: string | null;
  sessionId: string | null;
};

export default function KioskPage() {
  useKioskLifecycle();
  useWakeLock();
  useIdleTimer(40_000);

  const phase = useKiosk((s) => s.phase);
  const messages = useKiosk((s) => s.messages);
  const audioUrl = useKiosk((s) => s.audioUrl);
  const unlocked = useKiosk((s) => s.unlocked);
  const setPhase = useKiosk((s) => s.setPhase);
  const pushMessage = useKiosk((s) => s.pushMessage);
  const setAudio = useKiosk((s) => s.setAudio);
  const setError = useKiosk((s) => s.setError);
  const setLang = useKiosk((s) => s.setLang);
  const unlock = useKiosk((s) => s.unlock);
  const markInteraction = useKiosk((s) => s.markInteraction);
  const sessionId = useKiosk((s) => s.sessionId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const handleStopAndSendRef = useRef<() => Promise<void>>(async () => {});
  const { start, stop, level } = useRecorder({
    silenceMs: 1500,
    silenceThreshold: 0.04,
    maxMs: 12_000,
    onAutoStop: () => {
      // fires at most once per recording session; page drives stop()
      handleStopAndSendRef.current();
    },
  });

  const { viseme, gain } = useLipsync(audioElRef.current, phase === "speaking");

  /** Called on first user touch: creates <audio> inside the gesture chain */
  const handleFirstTap = useCallback(() => {
    if (unlocked) return;
    const el = new Audio();
    el.preload = "auto";
    el.autoplay = false;
    // 44 bytes of silent WAV — gives the element a valid src so
    // wawa-lipsync's createMediaElementSource wires up cleanly, and
    // the user-gesture play() here unlocks playback for later swaps.
    el.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    el.play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
      })
      .catch(() => {});
    audioElRef.current = el;
    unlock();
    setPhase("idle");
    markInteraction();
  }, [unlocked, unlock, setPhase, markInteraction]);

  const sendChat = useCallback(
    async (payload: FormData | { text: string }) => {
      setPhase("thinking");
      try {
        let res: Response;
        if (payload instanceof FormData) {
          payload.set("sessionId", sessionId);
          res = await fetch("/api/chat", { method: "POST", body: payload });
        } else {
          res = await fetch("/api/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId, chatInput: payload.text }),
          });
        }
        if (!res.ok) {
          const rawText = await res.text().catch(() => "");
          let detail: unknown = rawText;
          try {
            detail = JSON.parse(rawText);
          } catch {
            // keep the raw text so we can see what actually came back
          }
          console.error("[chat] upstream failed:", res.status, detail);
          throw new Error(
            `chat ${res.status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
          );
        }
        const data = (await res.json()) as ChatResponse;

        const lang: Lang = detectLang(data.output ?? "");
        setLang(lang);
        pushMessage({ role: "rouda", text: data.output ?? "…", lang });
        setAudio(data.audioUrl);
        if (data.audioUrl) {
          setPhase("speaking");
        } else {
          setPhase("idle");
        }
      } catch (err) {
        console.error("[chat] failed", err);
        setError("chat backend unreachable");
        pushMessage({
          role: "rouda",
          text: "Désolée, je n'arrive pas à répondre maintenant. Réessayez dans un instant.",
          lang: "fr",
        });
        setPhase("error");
      }
    },
    [pushMessage, sessionId, setAudio, setError, setLang, setPhase],
  );

  // Drive the audio element when audioUrl changes
  useEffect(() => {
    const el = audioElRef.current;
    if (!el || !audioUrl) return;
    console.info(
      "[audio] incoming clip:",
      audioUrl.slice(0, 48),
      "len=",
      audioUrl.length,
    );
    el.src = audioUrl;
    el.onended = () => setPhase("idle");
    el.onerror = () => {
      const me = el.error;
      console.error("[audio] element error:", {
        code: me?.code,
        message: me?.message,
        MEDIA_ERR_ABORTED: me?.MEDIA_ERR_ABORTED,
        MEDIA_ERR_NETWORK: me?.MEDIA_ERR_NETWORK,
        MEDIA_ERR_DECODE: me?.MEDIA_ERR_DECODE,
        MEDIA_ERR_SRC_NOT_SUPPORTED: me?.MEDIA_ERR_SRC_NOT_SUPPORTED,
      });
      setPhase("idle");
    };
    el.play()
      .then(() => {
        console.info("[audio] playback started");
      })
      .catch((err) => {
        console.warn("[audio] play blocked:", err);
        setPhase("idle");
      });
    return () => {
      el.onended = null;
      el.onerror = null;
    };
  }, [audioUrl, setPhase]);

  const handleMicPress = useCallback(async () => {
    markInteraction();
    handleFirstTap();

    if (phase === "listening") {
      await handleStopAndSendRef.current();
      return;
    }
    if (phase === "thinking" || phase === "speaking") {
      // user wants to interrupt — stop audio, go back to idle
      audioElRef.current?.pause();
      setPhase("idle");
      return;
    }
    setPhase("listening");
    try {
      await start();
    } catch {
      setPhase("error");
    }
  }, [handleFirstTap, markInteraction, phase, setPhase, start]);

  const handleStopAndSend = useCallback(async () => {
    const blob = await stop();
    if (!blob || blob.size < 1200) {
      setPhase("idle");
      return;
    }
    const form = new FormData();
    const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
    form.set("audio", blob, `speech.${ext}`);
    pushMessage({ role: "user", text: "…", lang: "fr" });
    await sendChat(form);
  }, [pushMessage, sendChat, setPhase, stop]);

  useEffect(() => {
    handleStopAndSendRef.current = handleStopAndSend;
  }, [handleStopAndSend]);

  const handleTextSend = useCallback(
    async (text: string) => {
      handleFirstTap();
      setDrawerOpen(false);
      const lang = detectLang(text);
      pushMessage({ role: "user", text, lang });
      await sendChat({ text });
    },
    [handleFirstTap, pushMessage, sendChat],
  );

  const lastRoudaMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "rouda") ?? null,
    [messages],
  );
  const lastUserMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === "user") ?? null,
    [messages],
  );

  return (
    <ErrorBoundary>
      <main
        className="relative mx-auto flex h-dvh w-dvw max-w-[1080px] flex-col overflow-hidden"
        onClick={markInteraction}
      >
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
          <Image
            src="/fpt-logo-blue.png"
            alt="Faculte Polydisciplinaire Taroudant"
            width={1800}
            height={430}
            className="h-auto w-full max-w-[920px] object-contain"
            priority
          />
        </div>

        {/* Top: character zone — ~60% */}
        <div
          className="relative flex shrink-0 items-end justify-center overflow-hidden"
          style={{ height: "58%" }}
        >
          <div className="pointer-events-none absolute inset-0">
            <BackgroundFX gain={gain} className="h-full w-full" />
          </div>
          <Rouda viseme={viseme} mouthGain={gain} className="relative h-full w-full" />

          {/* Phase pill — upper-left, machine-mono to feel intentional */}
          <div className="pointer-events-none absolute left-8 top-10">
            <span
              className="chip-sticker"
              style={{
                background:
                  phase === "listening"
                    ? "var(--color-teal)"
                    : phase === "thinking"
                      ? "var(--color-violet)"
                      : phase === "speaking"
                        ? "var(--color-saffron)"
                        : phase === "error"
                          ? "var(--color-signal)"
                          : "var(--color-base-100)",
                color:
                  phase === "idle" || phase === "boot" || phase === "attract"
                    ? "var(--color-ink)"
                    : "#fff",
              }}
            >
              {phaseLabel(phase)}
            </span>
          </div>

          {/* Signature mark — bottom right corner of the character zone */}
          <div className="pointer-events-none absolute bottom-6 right-8 font-mono text-kiosk-xs opacity-60">
            Rouda · FPT · Zyllux
          </div>
        </div>

        {/* Middle: transcript — flexes */}
        <div className="relative flex flex-1 flex-col items-center justify-end gap-6 px-6 pb-4">
          <AnimatePresence>
            {lastUserMessage && (
              <motion.div
                key={`u-${lastUserMessage.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 0.6, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full"
              >
                <TranscriptBubble message={lastUserMessage} />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="w-full">
            <TranscriptBubble message={lastRoudaMessage} />
          </div>
        </div>

        {/* Bottom: mic + text drawer trigger */}
        <div className="relative flex shrink-0 flex-col items-center gap-8 px-10 pb-16 pt-10">
          <MicButton onPress={handleMicPress} level={level} />

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => {
                handleFirstTap();
                setDrawerOpen(true);
              }}
              className="rounded-full border-[3px] px-8 py-4 font-mono uppercase tracking-widest text-kiosk-sm"
              style={{ borderColor: "var(--color-ink)", background: "var(--color-base-100)" }}
            >
              Écrire
            </button>

            <LangPills />
          </div>

          <p className="text-center font-mono text-kiosk-xs uppercase tracking-[0.18em] text-[var(--color-base-400)]">
            Developed by Hicham Boudouch and Hamza Bella
          </p>
        </div>

        {/* Boot gate — big first-touch affordance */}
        <AnimatePresence>
          {!unlocked && (
            <motion.button
              type="button"
              onClick={handleFirstTap}
              className="absolute inset-0 z-[70] flex flex-col items-center justify-center gap-10"
              style={{ background: "var(--color-base-50)" }}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src="/fpt-logo-blue.png"
                alt="Faculte Polydisciplinaire Taroudant"
                width={1800}
                height={430}
                className="h-auto w-full max-w-[760px] object-contain"
                priority
              />
              <motion.span
                className="chip-sticker"
                style={{ background: "var(--color-saffron)" }}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                Bienvenue
              </motion.span>
              <h1
                className="text-kiosk-xxl"
                style={{
                  fontFamily: "var(--font-display)",
                  fontVariationSettings: '"SOFT" 100, "wght" 640',
                  textAlign: "center",
                  maxWidth: "14ch",
                  lineHeight: 0.96,
                }}
              >
                Touchez pour parler à&nbsp;Rouda.
              </h1>
              <p
                className="text-kiosk-md"
                style={{ color: "var(--color-base-400)" }}
              >
                FPT Taroudant · Journées Portes Ouvertes
              </p>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "attract" && unlocked && (
            <AttractLoop
              onDismiss={() => {
                setPhase("idle");
                markInteraction();
              }}
            />
          )}
        </AnimatePresence>

        <TextDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSend={handleTextSend}
          disabled={phase === "thinking"}
        />
      </main>
    </ErrorBoundary>
  );
}

function phaseLabel(p: string): string {
  switch (p) {
    case "listening":
      return "à l'écoute";
    case "thinking":
      return "réflexion";
    case "speaking":
      return "réponse";
    case "attract":
      return "veille";
    case "error":
      return "erreur";
    case "boot":
      return "démarrage";
    default:
      return "prête";
  }
}

function LangPills() {
  const lang = useKiosk((s) => s.currentLang);
  const pills: { key: string; label: string }[] = [
    { key: "fr", label: "FR" },
    { key: "darija", label: "الدارجة" },
    { key: "ar", label: "العربية" },
  ];
  return (
    <div className="flex items-center gap-2">
      {pills.map((p) => {
        const active = p.key === lang;
        return (
          <span
            key={p.key}
            className="rounded-full border-[3px] px-4 py-2 font-mono text-kiosk-xs uppercase tracking-widest"
            style={{
              background: active ? "var(--color-ink)" : "transparent",
              color: active ? "#fff" : "var(--color-base-400)",
              borderColor: active ? "var(--color-ink)" : "var(--color-base-300)",
            }}
          >
            {p.label}
          </span>
        );
      })}
    </div>
  );
}
