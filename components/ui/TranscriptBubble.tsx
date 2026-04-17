"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { fontClassFor, isRTL } from "@/lib/lang";
import type { Message } from "@/lib/store";

type Props = {
  message: Message | null;
};

/**
 * Shows the most recent Rouda reply (and the user's last turn, below it in a
 * muted style). Kept short by design — a kiosk isn't a chat app; reading a
 * scrollback at 2m is unpleasant.
 */
export function TranscriptBubble({ message }: Props) {
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          key={message.id}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative mx-auto max-w-[90%] rounded-[40px] border-[3px] px-10 py-7",
            fontClassFor(message.lang),
          )}
          style={{
            borderColor: "var(--color-ink)",
            background:
              message.role === "rouda"
                ? "var(--color-base-50)"
                : "var(--color-base-100)",
            boxShadow:
              message.role === "rouda"
                ? "0 12px 0 0 var(--color-saffron)"
                : "0 10px 0 0 var(--color-base-300)",
            textAlign: isRTL(message.lang) ? "right" : "left",
          }}
        >
          {message.role === "user" && (
            <span
              className="absolute -top-5 left-10 rounded-full border-[3px] px-4 py-1 font-mono text-xs uppercase tracking-widest"
              style={{
                background: "var(--color-base-200)",
                borderColor: "var(--color-ink)",
                color: "var(--color-base-500)",
              }}
            >
              vous
            </span>
          )}
          <p className="text-kiosk-md" style={{ lineHeight: 1.35 }}>
            {message.text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
