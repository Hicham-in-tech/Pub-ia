"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { useKiosk } from "@/lib/store";

type Props = {
  onPress: () => void;
  level: number;
  disabled?: boolean;
};

/**
 * The single big affordance on the kiosk. Always centered bottom. When
 * listening, a breathing ring + live RMS arc. When thinking, three dots.
 * When speaking, it fades back to a listen prompt.
 */
export function MicButton({ onPress, level, disabled }: Props) {
  const phase = useKiosk((s) => s.phase);
  const listening = phase === "listening";
  const thinking = phase === "thinking";
  const speaking = phase === "speaking";

  const label =
    phase === "listening"
      ? "J'écoute…"
      : phase === "thinking"
        ? "Réflexion…"
        : phase === "speaking"
          ? "Je réponds…"
          : phase === "error"
            ? "Touchez pour réessayer"
            : "Touchez & parlez";

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-[var(--text-kiosk-xs)]",
        "focus:outline-none",
        disabled && "opacity-60",
      )}
      aria-label={label}
    >
      <div className="relative flex items-center justify-center">
        {/* Listening ring — scales with live RMS */}
        <AnimatePresence>
          {listening && (
            <motion.span
              key="ring"
              className="absolute rounded-full border-[3px]"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 0.65,
                scale: 1 + Math.min(0.5, level * 4),
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                width: "clamp(240px, 28vw, 460px)",
                height: "clamp(240px, 28vw, 460px)",
                borderColor: "var(--color-teal)",
              }}
              transition={{ duration: 0.08, ease: "linear" }}
            />
          )}
        </AnimatePresence>

        {/* Static pulse ring when listening */}
        {listening && (
          <motion.span
            className="absolute rounded-full"
            style={{
              width: "clamp(240px, 28vw, 460px)",
              height: "clamp(240px, 28vw, 460px)",
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--color-teal) 35%, transparent), transparent 70%)",
            }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.25, 0.6] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <motion.span
          className={cn(
            "relative flex items-center justify-center rounded-full border-[3px]",
            "transition-colors",
          )}
          style={{
            width: "clamp(180px, 20vw, 320px)",
            height: "clamp(180px, 20vw, 320px)",
            background: listening
              ? "var(--color-teal)"
              : thinking
                ? "var(--color-violet)"
                : speaking
                  ? "var(--color-saffron)"
                  : "var(--color-base-50)",
            borderColor: "var(--color-ink)",
            boxShadow: listening
              ? "0 14px 0 0 var(--color-teal-deep)"
              : thinking
                ? "0 14px 0 0 var(--color-violet-deep)"
                : speaking
                  ? "0 14px 0 0 var(--color-saffron-deep)"
                  : "0 14px 0 0 var(--color-base-300)",
          }}
          whileTap={{ y: 6, boxShadow: "0 6px 0 0 var(--color-base-300)" }}
          animate={{
            rotate: thinking ? 360 : 0,
          }}
          transition={{
            rotate: {
              duration: thinking ? 2.8 : 0,
              repeat: thinking ? Infinity : 0,
              ease: "linear",
            },
          }}
        >
          {thinking ? (
            <div className="flex gap-3">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="block rounded-full bg-white"
                  style={{ width: 18, height: 18 }}
                  animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          ) : (
            <MicIcon
              active={listening || speaking}
              color={listening || speaking ? "#fff" : "var(--color-ink)"}
            />
          )}
        </motion.span>
      </div>

      <span
        className="font-mono uppercase tracking-widest text-kiosk-sm"
        style={{
          color:
            phase === "error" ? "var(--color-signal)" : "var(--color-base-500)",
        }}
      >
        {label}
      </span>
    </button>
  );
}

function MicIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width="clamp(64px, 7vw, 120px)"
      height="clamp(64px, 7vw, 120px)"
      fill="none"
      stroke={color}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: active ? "drop-shadow(0 0 6px rgba(255,255,255,0.4))" : undefined }}
    >
      <rect x="18" y="6" width="12" height="24" rx="6" />
      <path d="M10 22 v2 a14 14 0 0 0 28 0 v-2" />
      <path d="M24 38 v6" />
      <path d="M16 44 h16" />
    </svg>
  );
}
