"use client";

import { memo, useRef } from "react";
import { motion, useAnimationFrame } from "framer-motion";
import { useKiosk } from "@/lib/store";

type Props = {
  /** 0..1 mouth gain — drives waveform amplitude while speaking */
  gain?: number;
  className?: string;
};

const PHASE_ACCENT = {
  boot: "var(--color-base-300)",
  idle: "var(--color-teal)",
  attract: "var(--color-teal)",
  listening: "var(--color-teal)",
  thinking: "var(--color-violet)",
  speaking: "var(--color-saffron)",
  error: "var(--color-signal)",
} as const;

/** Deterministic particle field — stable between renders, no layout thrash. */
const PARTICLES = Array.from({ length: 36 }, (_, i) => {
  const seed = (i + 1) * 1321;
  const x = ((seed * 9301 + 49297) % 233280) / 233280;
  const y = ((seed * 7177 + 13723) % 233280) / 233280;
  const r = ((seed * 4211 + 911) % 233280) / 233280;
  return {
    x: -500 + x * 1000,
    y: -500 + y * 1000,
    r: 1.2 + r * 2.8,
    phase: (x + y) * Math.PI * 2,
    speed: 0.3 + r * 0.9,
  };
});

const GRID_RAYS = Array.from({ length: 18 }, (_, i) => (i * 360) / 18);

export const BackgroundFX = memo(function BackgroundFX({ gain = 0, className }: Props) {
  const phase = useKiosk((s) => s.phase);
  const accent = PHASE_ACCENT[phase];

  const gridRef = useRef<SVGGElement | null>(null);
  const particlesRef = useRef<SVGGElement | null>(null);
  const scanRef = useRef<SVGRectElement | null>(null);
  const waveRef = useRef<SVGPathElement | null>(null);
  const wave2Ref = useRef<SVGPathElement | null>(null);
  const orbit1Ref = useRef<SVGCircleElement | null>(null);
  const orbit2Ref = useRef<SVGCircleElement | null>(null);
  const orbit3Ref = useRef<SVGCircleElement | null>(null);

  useAnimationFrame((t) => {
    const sec = t / 1000;

    // Radiating grid — slow rotation, always present
    if (gridRef.current) {
      const spin = phase === "thinking" ? sec * 14 : sec * 3;
      gridRef.current.setAttribute("transform", `rotate(${spin.toFixed(2)})`);
    }

    // Particles — float in a lazy orbit; each has its own phase + speed
    if (particlesRef.current) {
      const children = particlesRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const p = PARTICLES[i];
        if (!p) continue;
        const node = children[i] as SVGCircleElement;
        const wobble = Math.sin(sec * p.speed + p.phase) * 18;
        const wobble2 = Math.cos(sec * p.speed * 0.6 + p.phase) * 14;
        node.setAttribute("cx", (p.x + wobble).toFixed(2));
        node.setAttribute("cy", (p.y + wobble2).toFixed(2));
      }
    }

    // Listening: vertical scan line sweeps across
    if (scanRef.current) {
      if (phase === "listening") {
        scanRef.current.setAttribute("opacity", "0.85");
        const x = -500 + ((sec * 320) % 1000);
        scanRef.current.setAttribute("x", x.toFixed(2));
      } else {
        scanRef.current.setAttribute("opacity", "0");
      }
    }

    // Speaking: twin waveform ribbons driven by gain
    if (waveRef.current && wave2Ref.current) {
      if (phase === "speaking") {
        const amp = 40 + gain * 180;
        const freq = 0.012;
        const segs: string[] = [];
        const segs2: string[] = [];
        for (let x = -520; x <= 520; x += 12) {
          const y1 =
            Math.sin(x * freq + sec * 4) * amp +
            Math.sin(x * freq * 2.3 + sec * 2.8) * amp * 0.3;
          const y2 =
            Math.cos(x * freq * 1.1 + sec * 3.1) * amp * 0.85 +
            Math.sin(x * freq * 1.7 + sec * 5.2) * amp * 0.25;
          segs.push(`${x === -520 ? "M" : "L"}${x} ${y1.toFixed(1)}`);
          segs2.push(`${x === -520 ? "M" : "L"}${x} ${y2.toFixed(1)}`);
        }
        waveRef.current.setAttribute("d", segs.join(" "));
        wave2Ref.current.setAttribute("d", segs2.join(" "));
        waveRef.current.setAttribute("opacity", "0.7");
        wave2Ref.current.setAttribute("opacity", "0.4");
      } else {
        waveRef.current.setAttribute("opacity", "0");
        wave2Ref.current.setAttribute("opacity", "0");
      }
    }

    // Thinking: orbiting rings around center
    const showOrbits = phase === "thinking";
    const orbitOpacity = showOrbits ? "0.75" : "0";
    if (orbit1Ref.current) {
      orbit1Ref.current.setAttribute("opacity", orbitOpacity);
      if (showOrbits) {
        const dash = 40 + Math.sin(sec * 2) * 20;
        orbit1Ref.current.setAttribute("stroke-dashoffset", (sec * 120).toFixed(2));
        orbit1Ref.current.setAttribute("stroke-dasharray", `${dash.toFixed(1)} 22`);
      }
    }
    if (orbit2Ref.current) {
      orbit2Ref.current.setAttribute("opacity", orbitOpacity);
      if (showOrbits) {
        orbit2Ref.current.setAttribute("stroke-dashoffset", (sec * -180).toFixed(2));
      }
    }
    if (orbit3Ref.current) {
      orbit3Ref.current.setAttribute("opacity", orbitOpacity);
      if (showOrbits) {
        orbit3Ref.current.setAttribute("stroke-dashoffset", (sec * 90).toFixed(2));
      }
    }
  });

  return (
    <svg
      className={className}
      viewBox="-500 -500 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
      }}
    >
      <defs>
        {/* Center vignette — warm glow bleeds from the robot */}
        <radialGradient id="fx-center" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor={accent} stopOpacity="0.28" />
          <stop offset="55%" stopColor={accent} stopOpacity="0.06" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>

        {/* Soft ink vignette at edges so the scene is framed */}
        <radialGradient id="fx-edge" cx="0.5" cy="0.5" r="0.72">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>

        <linearGradient id="fx-scan" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity="0" />
          <stop offset="50%" stopColor={accent} stopOpacity="0.9" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>

        <filter id="fx-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>

        <filter id="fx-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Center warm glow */}
      <rect x="-500" y="-500" width="1000" height="1000" fill="url(#fx-center)" />

      {/* Radiating grid rays — rotate slowly, faster on thinking */}
      <g ref={gridRef} opacity="0.22">
        {GRID_RAYS.map((deg) => (
          <line
            key={deg}
            x1="0"
            y1="0"
            x2="0"
            y2="-620"
            stroke={accent}
            strokeWidth="1"
            transform={`rotate(${deg})`}
            strokeOpacity="0.45"
          />
        ))}
        {/* Concentric hex rings as grid anchors */}
        {[140, 220, 320, 440].map((r) => (
          <circle
            key={r}
            cx="0"
            cy="0"
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth="1"
            strokeOpacity="0.25"
            strokeDasharray="2 6"
          />
        ))}
      </g>

      {/* Drifting particles */}
      <g ref={particlesRef} filter="url(#fx-blur)">
        {PARTICLES.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={accent}
            opacity={0.35 + (i % 5) * 0.08}
          />
        ))}
      </g>

      {/* Orbit rings — thinking only */}
      <circle
        ref={orbit1Ref}
        cx="0"
        cy="0"
        r="260"
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="50 22"
        opacity="0"
      />
      <circle
        ref={orbit2Ref}
        cx="0"
        cy="0"
        r="340"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="12 18"
        opacity="0"
      />
      <circle
        ref={orbit3Ref}
        cx="0"
        cy="0"
        r="420"
        fill="none"
        stroke={accent}
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="4 14"
        opacity="0"
      />

      {/* Listening scan line */}
      <rect
        ref={scanRef}
        x="-500"
        y="-500"
        width="6"
        height="1000"
        fill="url(#fx-scan)"
        opacity="0"
        filter="url(#fx-glow)"
      />

      {/* Speaking waveforms */}
      <path
        ref={wave2Ref}
        fill="none"
        stroke={accent}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0"
        filter="url(#fx-blur)"
      />
      <path
        ref={waveRef}
        fill="none"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0"
        filter="url(#fx-glow)"
      />

      {/* Idle drift: subtle floating arc that rotates slowly */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "center", opacity: phase === "idle" || phase === "attract" ? 0.5 : 0 }}
      >
        <path
          d="M -380 0 A 380 380 0 0 1 380 0"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeDasharray="1 28"
          strokeLinecap="round"
        />
      </motion.g>

      {/* Pulsing bloom: idle slow breath, speaking pulses with gain */}
      <motion.circle
        cx="0"
        cy="0"
        r="180"
        fill={accent}
        filter="url(#fx-glow)"
        animate={{
          opacity:
            phase === "speaking"
              ? 0.08 + gain * 0.32
              : phase === "listening"
                ? [0.08, 0.22, 0.08]
                : phase === "thinking"
                  ? [0.1, 0.2, 0.1]
                  : [0.04, 0.1, 0.04],
          scale:
            phase === "speaking"
              ? 0.95 + gain * 0.35
              : phase === "listening"
                ? [0.95, 1.08, 0.95]
                : [0.92, 1.04, 0.92],
        }}
        transition={{
          duration: phase === "speaking" ? 0.18 : phase === "listening" ? 1.4 : 3.6,
          repeat: phase === "speaking" ? 0 : Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Edge vignette on top */}
      <rect x="-500" y="-500" width="1000" height="1000" fill="url(#fx-edge)" />
    </svg>
  );
});
