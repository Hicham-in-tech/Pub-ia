import { describe, expect, it } from "vitest";
import { detectLang, fontClassFor, isRTL, systemLabel } from "@/lib/lang";

describe("detectLang", () => {
  it("returns 'ar' when the text contains Arabic characters", () => {
    expect(detectLang("مرحبا")).toBe("ar");
    expect(detectLang("Bonjour, مرحبا, mixed")).toBe("ar");
  });

  it("returns 'darija' when it spots Latin-script Moroccan hints", () => {
    expect(detectLang("wach kayn TP f had lasbou3")).toBe("darija");
    expect(detectLang("chokran bzaf")).toBe("darija");
  });

  it("defaults to 'fr' for French or unknown Latin text", () => {
    expect(detectLang("Bonjour, je voudrais savoir…")).toBe("fr");
    expect(detectLang("")).toBe("fr");
  });
});

describe("isRTL / fontClassFor / systemLabel", () => {
  it("flags only Arabic as RTL", () => {
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("fr")).toBe(false);
    expect(isRTL("darija")).toBe(false);
  });

  it("returns the Arabic class for Arabic text only", () => {
    expect(fontClassFor("ar")).toBe("is-ar");
    expect(fontClassFor("fr")).toBe("");
    expect(fontClassFor("darija")).toBe("");
  });

  it("gives readable labels for each language", () => {
    expect(systemLabel("fr")).toBe("Français");
    expect(systemLabel("ar")).toBe("العربية");
    expect(systemLabel("darija")).toBe("الدارجة");
  });
});
