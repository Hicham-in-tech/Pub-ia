/**
 * Viseme palette for the robot. Each viseme is a 9-bar LED mouth pattern —
 * numbers in [0, 1] that the component scales to pixel heights at render.
 *
 * Wawa-lipsync emits categories like "viseme_aa" from its AudioContext
 * analyser; normalizeViseme maps them into this palette.
 */

export type Viseme = "sil" | "PP" | "FF" | "DD" | "kk" | "CH" | "aa" | "E" | "I" | "O";

export const VISEME_LIST: readonly Viseme[] = [
  "sil",
  "PP",
  "FF",
  "DD",
  "kk",
  "CH",
  "aa",
  "E",
  "I",
  "O",
] as const;

/** 9-bar heights, 0 (closed) → 1 (fully open). Symmetric where phoneme is. */
export const VISEME_BARS: Record<Viseme, readonly number[]> = {
  //         idx:   0     1     2     3     4     5     6     7     8
  sil: [0.08, 0.08, 0.1, 0.14, 0.16, 0.14, 0.1, 0.08, 0.08],
  PP: [0.1, 0.12, 0.14, 0.18, 0.2, 0.18, 0.14, 0.12, 0.1],
  FF: [0.2, 0.24, 0.3, 0.38, 0.45, 0.38, 0.3, 0.24, 0.2],
  DD: [0.2, 0.28, 0.42, 0.52, 0.6, 0.52, 0.42, 0.28, 0.2],
  kk: [0.28, 0.42, 0.56, 0.7, 0.78, 0.7, 0.56, 0.42, 0.28],
  CH: [0.15, 0.28, 0.48, 0.66, 0.72, 0.66, 0.48, 0.28, 0.15],
  aa: [0.38, 0.55, 0.74, 0.9, 1.0, 0.9, 0.74, 0.55, 0.38],
  E: [0.5, 0.6, 0.68, 0.72, 0.74, 0.72, 0.68, 0.6, 0.5],
  I: [0.58, 0.52, 0.44, 0.38, 0.34, 0.38, 0.44, 0.52, 0.58],
  O: [0.08, 0.18, 0.42, 0.76, 1.0, 0.76, 0.42, 0.18, 0.08],
};

export const BAR_COUNT = 9;

export function normalizeViseme(raw: string | undefined | null): Viseme {
  if (!raw) return "sil";
  // wawa-lipsync emits "viseme_aa"; other sources may emit "aa" or "AA".
  const stripped = raw.replace(/^viseme_/i, "");
  const v = stripped.toLowerCase();
  switch (v) {
    case "aa":
    case "a":
      return "aa";
    case "e":
    case "ee":
      return "E";
    case "i":
    case "eh":
      return "I";
    case "o":
    case "oo":
    case "u":
    case "uu":
      return "O";
    case "pp":
    case "p":
    case "b":
    case "m":
      return "PP";
    case "ff":
    case "f":
    case "v":
      return "FF";
    case "th":
    case "dd":
    case "t":
    case "d":
    case "n":
    case "l":
    case "nn":
    case "rr":
      return "DD";
    case "kk":
    case "k":
    case "g":
    case "ng":
      return "kk";
    case "ch":
    case "sh":
    case "ss":
    case "j":
    case "zz":
      return "CH";
    case "sil":
    case "":
      return "sil";
    default:
      return "sil";
  }
}
