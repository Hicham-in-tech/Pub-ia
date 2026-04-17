"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame } from "framer-motion";
import { BAR_COUNT, VISEME_BARS, type Viseme } from "./visemes";
import { useKiosk } from "@/lib/store";

type Props = {
  /** current viseme from wawa-lipsync (or "sil" when silent) */
  viseme?: Viseme;
  /** 0..1 overall mouth openness — scales the mouth bars for loudness */
  mouthGain?: number;
  className?: string;
};

/** Every few seconds, flash the eyes as if the LEDs blink-flickered. */
function useFlicker() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      const next = 2400 + Math.random() * 3600;
      window.setTimeout(() => {
        setOn(false);
        window.setTimeout(() => {
          setOn(true);
          loop();
        }, 70 + Math.random() * 90);
      }, next);
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, []);
  return on;
}

const PHASE_COLOR = {
  boot: "var(--color-base-300)",
  idle: "var(--color-teal)",
  attract: "var(--color-teal)",
  listening: "var(--color-teal)",
  thinking: "var(--color-violet)",
  speaking: "var(--color-saffron)",
  error: "var(--color-signal)",
} as const;

export const Rouda = memo(function Rouda({
  viseme = "sil",
  mouthGain = 0,
  className,
}: Props) {
  const phase = useKiosk((s) => s.phase);
  const eyesOn = useFlicker();
  const bobRef = useRef<SVGGElement | null>(null);
  const irisRef = useRef<SVGGElement | null>(null);
  const antennaRef = useRef<SVGCircleElement | null>(null);

  // Hovering chassis bob. Speaking = tighter, higher-frequency micro-tremor.
  useAnimationFrame((t) => {
    if (!bobRef.current) return;
    const speaking = phase === "speaking";
    const listening = phase === "listening";
    const amp = speaking ? 0.8 : listening ? 2.2 : 3.2;
    const freq = speaking ? 3.4 : listening ? 1.1 : 0.55;
    const y = Math.sin((t / 1000) * freq * Math.PI) * amp;
    bobRef.current.setAttribute("transform", `translate(0 ${y.toFixed(2)})`);

    // Iris rings rotate faster while thinking
    if (irisRef.current) {
      const speed = phase === "thinking" ? 0.18 : phase === "listening" ? 0.05 : 0.015;
      irisRef.current.setAttribute("transform", `rotate(${((t * speed) % 360).toFixed(2)})`);
    }

    // Antenna pulse — breathing when idle, fast blink when listening
    if (antennaRef.current) {
      const breathe =
        phase === "listening"
          ? 0.5 + 0.5 * Math.abs(Math.sin(t * 0.012))
          : phase === "speaking"
            ? 0.6 + mouthGain * 0.6
            : 0.35 + 0.35 * Math.sin(t * 0.0016);
      antennaRef.current.setAttribute("opacity", Math.min(1, breathe).toFixed(3));
      antennaRef.current.setAttribute("r", (10 + breathe * 6).toFixed(2));
    }
  });

  const accent = PHASE_COLOR[phase];
  const bars = VISEME_BARS[viseme] ?? VISEME_BARS.sil;
  const gainScale = 0.75 + Math.min(1, Math.max(0, mouthGain)) * 0.6;

  return (
    <motion.svg
      className={className}
      viewBox="-500 -600 1000 1100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        {/* Porcelain chassis — warm, not cold chrome */}
        <linearGradient id="chassis" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdf7e8" />
          <stop offset="60%" stopColor="#e6dcc6" />
          <stop offset="100%" stopColor="#9a8d6f" />
        </linearGradient>

        <linearGradient id="chassis-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c9b891" />
          <stop offset="100%" stopColor="#574a2e" />
        </linearGradient>

        {/* Screen glow behind the face */}
        <radialGradient id="faceglow" cx="0.5" cy="0.5" r="0.55">
          <stop offset="0%" stopColor={accent} stopOpacity="0.75" />
          <stop offset="45%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>

        {/* Eye LED gradient */}
        <radialGradient id="ledEye" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor={accent} />
          <stop offset="100%" stopColor="#1a1712" />
        </radialGradient>

        {/* Glow filter for accents */}
        <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Back aura disc — pulses with phase */}
      <motion.circle
        cx="0"
        cy="-80"
        r="540"
        fill="url(#faceglow)"
        animate={{
          scale:
            phase === "listening" || phase === "speaking" ? [1, 1.05, 1] : 1,
          opacity: phase === "idle" || phase === "boot" ? 0.55 : 1,
        }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />

      <g ref={bobRef}>
        {/* ─── Antenna ─── */}
        <line
          x1="0"
          y1="-420"
          x2="0"
          y2="-500"
          stroke="url(#chassis-rim)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle
          ref={antennaRef}
          cx="0"
          cy="-510"
          r="10"
          fill={accent}
          filter="url(#neon)"
        />

        {/* ─── Shoulder chassis hint ─── */}
        <path
          d="M-300 340 Q-200 300 -120 300 L120 300 Q200 300 300 340 L320 440 Q0 420 -320 440 Z"
          fill="url(#chassis)"
          stroke="#6a5b3e"
          strokeWidth="3"
        />
        <path
          d="M-260 340 L-260 420 M260 340 L260 420"
          stroke="#574a2e"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Neck servo */}
        <rect x="-40" y="280" width="80" height="70" rx="18" fill="url(#chassis)" stroke="#6a5b3e" strokeWidth="3" />
        <circle cx="0" cy="315" r="8" fill={accent} filter="url(#glow-soft)" />

        {/* ─── Head plate — hexagonal porcelain ─── */}
        <g>
          <path
            d="M-280 -400
               L-340 -150
               L-300 120
               L-180 260
               L180 260
               L300 120
               L340 -150
               L280 -400
               Z"
            fill="url(#chassis)"
            stroke="#6a5b3e"
            strokeWidth="5"
            strokeLinejoin="round"
          />

          {/* Inner face panel — darker, the "screen" */}
          <path
            d="M-220 -340
               L-270 -140
               L-240 90
               L-140 200
               L140 200
               L240 90
               L270 -140
               L220 -340
               Z"
            fill="#1d1b16"
            stroke={accent}
            strokeWidth="2"
            strokeOpacity="0.5"
            filter="url(#glow-soft)"
          />

          {/* Panel top stripe LEDs */}
          {[-140, -70, 0, 70, 140].map((x, i) => (
            <motion.rect
              key={i}
              x={x - 14}
              y={-320}
              width="28"
              height="5"
              rx="2"
              fill={accent}
              animate={{
                opacity:
                  phase === "thinking"
                    ? [0.2, 1, 0.2]
                    : phase === "listening"
                      ? [0.3, 0.9, 0.3]
                      : 0.5,
              }}
              transition={{
                duration: phase === "thinking" ? 0.8 : 1.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.1,
              }}
            />
          ))}

          {/* Cheek vents — horizontal louvres */}
          {[-1, 0, 1].map((i) => (
            <rect
              key={`lvl-${i}`}
              x="-280"
              y={20 + i * 24}
              width="60"
              height="8"
              rx="4"
              fill="#2a2620"
            />
          ))}
          {[-1, 0, 1].map((i) => (
            <rect
              key={`lvr-${i}`}
              x="220"
              y={20 + i * 24}
              width="60"
              height="8"
              rx="4"
              fill="#2a2620"
            />
          ))}
        </g>

        {/* ─── Eyes — camera iris LEDs ─── */}
        <g>
          {/* left */}
          <motion.g
            animate={{ scaleY: eyesOn ? 1 : 0.08 }}
            transition={{ duration: 0.08, ease: "easeOut" }}
            style={{ transformOrigin: "-125px -150px", transformBox: "fill-box" }}
          >
            <circle cx="-125" cy="-150" r="70" fill="#0c0a08" stroke={accent} strokeWidth="3" />
            <circle cx="-125" cy="-150" r="56" fill="url(#ledEye)" />
            {/* iris segmented ring */}
            <g ref={phase === "thinking" ? irisRef : undefined} style={{ transformOrigin: "-125px -150px", transformBox: "fill-box" }}>
              {[...Array(12)].map((_, k) => (
                <rect
                  key={k}
                  x={-125 - 2}
                  y={-150 - 60}
                  width="4"
                  height="14"
                  rx="1.5"
                  fill={accent}
                  opacity="0.7"
                  transform={`rotate(${k * 30} -125 -150)`}
                />
              ))}
            </g>
            <circle cx="-125" cy="-150" r="18" fill="#0c0a08" />
            <circle cx="-119" cy="-158" r="5" fill="#ffffff" />
          </motion.g>

          {/* right */}
          <motion.g
            animate={{ scaleY: eyesOn ? 1 : 0.08 }}
            transition={{ duration: 0.08, ease: "easeOut" }}
            style={{ transformOrigin: "125px -150px", transformBox: "fill-box" }}
          >
            <circle cx="125" cy="-150" r="70" fill="#0c0a08" stroke={accent} strokeWidth="3" />
            <circle cx="125" cy="-150" r="56" fill="url(#ledEye)" />
            <g>
              {[...Array(12)].map((_, k) => (
                <rect
                  key={k}
                  x={125 - 2}
                  y={-150 - 60}
                  width="4"
                  height="14"
                  rx="1.5"
                  fill={accent}
                  opacity="0.7"
                  transform={`rotate(${k * 30} 125 -150)`}
                />
              ))}
            </g>
            <circle cx="125" cy="-150" r="18" fill="#0c0a08" />
            <circle cx="131" cy="-158" r="5" fill="#ffffff" />
          </motion.g>
        </g>

        {/* ─── Mouth — 9-bar LED equalizer ─── */}
        <g transform="translate(0 90)">
          {/* Mouth housing */}
          <rect
            x="-180"
            y="-70"
            width="360"
            height="140"
            rx="26"
            fill="#100e0b"
            stroke={accent}
            strokeWidth="2"
            strokeOpacity="0.6"
          />
          {/* Bars */}
          {Array.from({ length: BAR_COUNT }).map((_, i) => {
            const maxH = 110;
            const h = Math.max(6, (bars[i] ?? 0) * maxH * gainScale);
            const barW = 26;
            const gap = 8;
            const totalW = BAR_COUNT * barW + (BAR_COUNT - 1) * gap;
            const x = -totalW / 2 + i * (barW + gap);
            return (
              <motion.rect
                key={i}
                x={x}
                width={barW}
                rx="6"
                fill={accent}
                filter="url(#glow-soft)"
                animate={{
                  height: h,
                  y: -h / 2,
                }}
                transition={{ duration: 0.07, ease: "linear" }}
              />
            );
          })}
        </g>

        {/* Status chip: small ID plate under the mouth */}
        <g transform="translate(0 230)">
          <rect
            x="-90"
            y="-16"
            width="180"
            height="32"
            rx="8"
            fill="#100e0b"
            stroke="#574a2e"
            strokeWidth="2"
          />
          <text
            x="0"
            y="6"
            textAnchor="middle"
            fontFamily="ui-monospace, monospace"
            fontSize="18"
            letterSpacing="4"
            fill={accent}
          >
            ROUDA · FPT
          </text>
        </g>
      </g>
    </motion.svg>
  );
});
