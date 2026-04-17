"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { detectLang, fontClassFor } from "@/lib/lang";

type Props = {
  open: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  disabled?: boolean;
};

/**
 * A slide-up drawer with a text input, for when the mic is unreliable or the
 * environment is too noisy. Auto-detects language from what's typed so the
 * layout can swap RTL for Arabic on the fly.
 */
export function TextDrawer({ open, onClose, onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const lang = detectLang(value);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => taRef.current?.focus(), 240);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="drawer-backdrop"
          className="fixed inset-0 z-40"
          style={{ background: "rgba(26,23,18,0.35)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            key="drawer"
            className="absolute inset-x-0 bottom-0 z-50 rounded-t-[48px] border-t-[3px] p-10"
            style={{
              background: "var(--color-base-50)",
              borderColor: "var(--color-ink)",
              boxShadow: "0 -24px 0 0 var(--color-base-200)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 180, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-6">
              <span
                className="font-mono uppercase tracking-[0.2em] text-kiosk-sm"
                style={{ color: "var(--color-base-400)" }}
              >
                Écrire à Rouda
              </span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border-[3px] px-6 py-3 font-mono uppercase tracking-widest text-kiosk-sm"
                style={{ borderColor: "var(--color-ink)", background: "var(--color-base-100)" }}
              >
                Fermer
              </button>
            </div>

            <textarea
              ref={taRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={disabled}
              placeholder="Posez votre question…"
              rows={3}
              className={cn(
                "w-full resize-none rounded-[32px] border-[3px] p-8 text-kiosk-md outline-none",
                fontClassFor(lang),
              )}
              style={{
                borderColor: "var(--color-ink)",
                background: "var(--color-base-100)",
                textAlign: lang === "ar" ? "right" : "left",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />

            <div className="flex justify-end pt-6">
              <button
                type="button"
                onClick={submit}
                disabled={disabled || !value.trim()}
                className="rounded-full px-10 py-5 font-mono uppercase tracking-widest text-kiosk-md disabled:opacity-40"
                style={{
                  background: "var(--color-saffron)",
                  color: "var(--color-ink)",
                  boxShadow: "0 10px 0 0 var(--color-saffron-deep)",
                }}
              >
                Envoyer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
