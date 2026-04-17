"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type Phase = "boot" | "idle" | "attract" | "listening" | "thinking" | "speaking" | "error";
export type Lang = "fr" | "ar" | "darija";

export type Message = {
  id: string;
  role: "user" | "rouda";
  text: string;
  lang: Lang;
  at: number;
};

type State = {
  phase: Phase;
  lastInteractionAt: number;
  sessionId: string;
  messages: Message[];
  currentLang: Lang;
  errorMsg: string | null;
  /** base64 data URL of the reply audio, fed to <audio> + wawa-lipsync */
  audioUrl: string | null;
  /** live mic RMS 0–1 for the "listening" UI ring */
  inputLevel: number;
  /** true between first tap and the first tts play — kiosk gesture chain is unlocked */
  unlocked: boolean;
};

type Actions = {
  setPhase: (p: Phase) => void;
  setLang: (l: Lang) => void;
  pushMessage: (m: Omit<Message, "id" | "at">) => void;
  setAudio: (url: string | null) => void;
  setInputLevel: (v: number) => void;
  setError: (msg: string | null) => void;
  markInteraction: () => void;
  unlock: () => void;
  resetSession: () => void;
};

const newSessionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useKiosk = create<State & Actions>()(
  subscribeWithSelector((set) => ({
    phase: "boot",
    lastInteractionAt: Date.now(),
    sessionId: newSessionId(),
    messages: [],
    currentLang: "fr",
    errorMsg: null,
    audioUrl: null,
    inputLevel: 0,
    unlocked: false,

    setPhase: (phase) => set({ phase }),
    setLang: (currentLang) => set({ currentLang }),
    pushMessage: (m) =>
      set((s) => ({
        messages: [
          ...s.messages.slice(-20),
          { ...m, id: newSessionId(), at: Date.now() },
        ],
      })),
    setAudio: (audioUrl) => set({ audioUrl }),
    setInputLevel: (inputLevel) => set({ inputLevel }),
    setError: (errorMsg) => set({ errorMsg }),
    markInteraction: () => set({ lastInteractionAt: Date.now() }),
    unlock: () => set({ unlocked: true }),
    resetSession: () =>
      set({
        sessionId: newSessionId(),
        messages: [],
        phase: "idle",
        errorMsg: null,
        audioUrl: null,
        currentLang: "fr",
        lastInteractionAt: Date.now(),
      }),
  })),
);

/* Tiny helper to subscribe once for audio playback side-effects */
export const onPhaseChange = (cb: (p: Phase) => void) =>
  useKiosk.subscribe((s) => s.phase, cb);
