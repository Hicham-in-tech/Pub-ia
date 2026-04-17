"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const PROMPTS: { text: string; langClass?: string; accent: string }[] = [
  { text: "Posez-moi une question sur la FPT.", accent: "var(--color-saffron)" },
  { text: "قولي بالدارجة، وأنا نفهمك.", langClass: "is-ar", accent: "var(--color-teal)" },
  { text: "Demandez — filières, inscription, orientation.", accent: "var(--color-lime)" },
  { text: "سؤالك على الكلية؟ أجاوبك.", langClass: "is-ar", accent: "var(--color-violet)" },
  { text: "Je suis Rouda. Je parle et j'écoute.", accent: "var(--color-saffron)" },
];

/**
 * Full-screen overlay that cycles a few multi-language prompts when no one
 * has interacted for 40s+. Tapping anywhere dismisses it.
 */
export function AttractLoop({ onDismiss }: { onDismiss: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((v) => (v + 1) % PROMPTS.length), 3400);
    return () => window.clearInterval(id);
  }, []);

  const current = PROMPTS[i] ?? PROMPTS[0]!;

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-16 px-16 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onDismiss}
      style={{
        background: "var(--color-base-50)",
      }}
    >
      {/* Drifting decorative squiggles that evoke Moroccan zellige without mimicking it */}
      <Glyphs />

      <motion.span
        className="chip-sticker"
        style={{ background: current.accent, color: "var(--color-ink)" }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        Touchez pour parler
      </motion.span>

      <AnimatePresence mode="wait">
        <motion.h2
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`text-kiosk-xxl ${current.langClass ?? ""}`}
          style={{
            fontFamily: "var(--font-display)",
            fontVariationSettings: '"SOFT" 100, "wght" 600, "opsz" 144',
            color: "var(--color-ink)",
            maxWidth: "18ch",
          }}
        >
          {current.text}
        </motion.h2>
      </AnimatePresence>

      <div className="flex gap-3">
        {PROMPTS.map((_, idx) => (
          <span
            key={idx}
            className="h-2 w-16 rounded-full transition-colors"
            style={{
              background: idx === i ? "var(--color-ink)" : "var(--color-base-200)",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function Glyphs() {
  const glyphs = [
    { top: "6%", left: "8%", rot: -14, color: "var(--color-saffron)" },
    { top: "18%", left: "75%", rot: 24, color: "var(--color-teal)" },
    { top: "48%", left: "4%", rot: 8, color: "var(--color-lime)" },
    { top: "72%", left: "72%", rot: -6, color: "var(--color-violet)" },
    { top: "84%", left: "18%", rot: 18, color: "var(--color-saffron-deep)" },
  ];
  return (
    <>
      {glyphs.map((g, i) => (
        <motion.svg
          key={i}
          className="pointer-events-none absolute"
          viewBox="0 0 100 100"
          width="120"
          height="120"
          style={{ top: g.top, left: g.left, color: g.color }}
          animate={{ rotate: [g.rot, g.rot + 8, g.rot], y: [0, -6, 0] }}
          transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M50 8 L62 40 L95 45 L68 65 L78 95 L50 78 L22 95 L32 65 L5 45 L38 40 Z"
            fill="currentColor"
            opacity="0.9"
          />
        </motion.svg>
      ))}
    </>
  );
}
