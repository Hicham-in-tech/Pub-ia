import type { Lang } from "./store";

export type { Lang };

const ARABIC_RE = /[\u0600-\u06FF]/;
const DARIJA_LATIN_HINT = /\b(wach|chno|kifach|ma3reftch|salam|chokran|bghit|bzaf|mezyan|fin)\b/i;

export function detectLang(text: string): Lang {
  if (ARABIC_RE.test(text)) return "ar";
  if (DARIJA_LATIN_HINT.test(text)) return "darija";
  return "fr";
}

export function isRTL(lang: Lang): boolean {
  return lang === "ar";
}

export function fontClassFor(lang: Lang): string {
  return lang === "ar" ? "is-ar" : "";
}

export function systemLabel(lang: Lang): string {
  switch (lang) {
    case "ar":
      return "العربية";
    case "darija":
      return "الدارجة";
    case "fr":
    default:
      return "Français";
  }
}
