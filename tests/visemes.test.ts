import { describe, expect, it } from "vitest";
import { BAR_COUNT, VISEME_BARS, VISEME_LIST, normalizeViseme } from "@/components/character/visemes";

describe("normalizeViseme", () => {
  it("strips the wawa-lipsync 'viseme_' prefix", () => {
    expect(normalizeViseme("viseme_aa")).toBe("aa");
    expect(normalizeViseme("viseme_O")).toBe("O");
    expect(normalizeViseme("viseme_sil")).toBe("sil");
  });

  it("maps uppercase phoneme shortcuts", () => {
    expect(normalizeViseme("AA")).toBe("aa");
    expect(normalizeViseme("PP")).toBe("PP");
    expect(normalizeViseme("CH")).toBe("CH");
  });

  it("collapses vowels toward the nearest supported viseme", () => {
    expect(normalizeViseme("U")).toBe("O");
    expect(normalizeViseme("EE")).toBe("E");
    expect(normalizeViseme("EH")).toBe("I");
  });

  it("falls back to 'sil' on unknown/missing input", () => {
    expect(normalizeViseme(undefined)).toBe("sil");
    expect(normalizeViseme(null)).toBe("sil");
    expect(normalizeViseme("")).toBe("sil");
    expect(normalizeViseme("viseme_unknown")).toBe("sil");
  });
});

describe("viseme bar palette", () => {
  it("every listed viseme has a bar array of BAR_COUNT entries", () => {
    for (const v of VISEME_LIST) {
      expect(VISEME_BARS[v]).toHaveLength(BAR_COUNT);
    }
  });

  it("all bar values are normalized within [0, 1]", () => {
    for (const v of VISEME_LIST) {
      for (const h of VISEME_BARS[v]) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
      }
    }
  });

  it("'aa' peaks at the center bar (fully open vowel)", () => {
    expect(VISEME_BARS.aa[4]).toBe(1.0);
  });

  it("'sil' stays low across the mouth (mostly closed)", () => {
    for (const h of VISEME_BARS.sil) {
      expect(h).toBeLessThan(0.2);
    }
  });

  it("symmetric visemes mirror around the center bar", () => {
    for (const v of VISEME_LIST) {
      const bars = VISEME_BARS[v];
      for (let i = 0; i < Math.floor(BAR_COUNT / 2); i++) {
        const left = bars[i] ?? 0;
        const right = bars[BAR_COUNT - 1 - i] ?? 0;
        expect(left).toBeCloseTo(right, 5);
      }
    }
  });
});
