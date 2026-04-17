import { beforeEach, describe, expect, it } from "vitest";
import { useKiosk } from "@/lib/store";

function reset() {
  useKiosk.getState().resetSession();
  useKiosk.getState().setPhase("boot");
}

describe("kiosk store", () => {
  beforeEach(reset);

  it("starts in boot and becomes idle on resetSession", () => {
    expect(useKiosk.getState().phase).toBe("boot");
    useKiosk.getState().resetSession();
    expect(useKiosk.getState().phase).toBe("idle");
  });

  it("transitions through the listening → thinking → speaking loop", () => {
    const s = useKiosk.getState();
    s.setPhase("idle");
    s.setPhase("listening");
    expect(useKiosk.getState().phase).toBe("listening");
    s.setPhase("thinking");
    expect(useKiosk.getState().phase).toBe("thinking");
    s.setPhase("speaking");
    expect(useKiosk.getState().phase).toBe("speaking");
  });

  it("pushes messages and keeps them under the cap", () => {
    const s = useKiosk.getState();
    for (let i = 0; i < 40; i++) {
      s.pushMessage({ role: "user", text: `m${i}`, lang: "fr" });
    }
    const messages = useKiosk.getState().messages;
    expect(messages.length).toBeLessThanOrEqual(21);
    expect(messages.at(-1)?.text).toBe("m39");
  });

  it("tracks language and interaction timestamp", () => {
    const beforeAt = useKiosk.getState().lastInteractionAt;
    useKiosk.getState().setLang("ar");
    expect(useKiosk.getState().currentLang).toBe("ar");
    // micro-sleep via a busy wait — tests shouldn't rely on timers
    const start = Date.now();
    while (Date.now() === start) {
      /* spin one tick */
    }
    useKiosk.getState().markInteraction();
    expect(useKiosk.getState().lastInteractionAt).toBeGreaterThan(beforeAt);
  });

  it("unlock flips the gesture gate without resetting state", () => {
    const s = useKiosk.getState();
    s.setPhase("listening");
    s.unlock();
    expect(useKiosk.getState().unlocked).toBe(true);
    expect(useKiosk.getState().phase).toBe("listening");
  });
});
