import { describe, expect, it } from "vitest";
import { flipPlacement, type Placement, type Rect, type Size } from "./appPopoverPlacement";

// A viewport with generous room on every side — the baseline "nothing flips".
const ROOMY: Size = { width: 1200, height: 900 };

// A trigger sitting comfortably in the middle of ROOMY.
const CENTRE_TRIGGER: Rect = { left: 560, right: 600, top: 440, bottom: 460 };

const SMALL_PANEL: Size = { width: 240, height: 120 };

function flip(
  preferred: Placement,
  over: Partial<{ trigger: Rect; panel: Size; viewport: Size }> = {},
) {
  return flipPlacement(
    preferred,
    over.trigger ?? CENTRE_TRIGGER,
    over.panel ?? SMALL_PANEL,
    over.viewport ?? ROOMY,
  );
}

describe("flipPlacement", () => {
  it("leaves the preferred placement untouched when the panel fits", () => {
    for (const p of ["bottom-start", "bottom", "bottom-end", "top-start", "top", "top-end"] as const) {
      expect(flip(p)).toBe(p);
    }
  });

  it("flips -start to -end when the panel would overflow the right edge and the left has room", () => {
    // Trigger hard against the right edge, vertically centred so only the
    // horizontal axis is in play.
    const trigger: Rect = { left: 1150, right: 1190, top: 440, bottom: 460 };
    expect(flip("bottom-start", { trigger })).toBe("bottom-end");
    expect(flip("top-start", { trigger })).toBe("top-end");
  });

  it("flips -end to -start when the panel would overflow the left edge and the right has room", () => {
    const trigger: Rect = { left: 10, right: 50, top: 440, bottom: 460 };
    expect(flip("bottom-end", { trigger })).toBe("bottom-start");
    expect(flip("top-end", { trigger })).toBe("top-start");
  });

  it("keeps the preferred side when neither side can fit the panel", () => {
    const trigger: Rect = { left: 190, right: 210, top: 440, bottom: 460 };
    // Panel wider than the whole viewport — flipping cannot help.
    expect(
      flip("bottom-start", {
        trigger,
        panel: { width: 420, height: 100 },
        viewport: { width: 400, height: 800 },
      }),
    ).toBe("bottom-start");
  });

  it("does not add a horizontal suffix to a centre-aligned placement", () => {
    const trigger: Rect = { left: 1150, right: 1190, top: 440, bottom: 460 };
    expect(flip("bottom", { trigger })).toBe("bottom");
    expect(flip("top", { trigger })).toBe("top");
  });

  it("flips bottom* to top* when the panel does not fit below and there is more room above", () => {
    const trigger: Rect = { left: 560, right: 600, top: 840, bottom: 860 };
    expect(flip("bottom-start", { trigger, panel: { width: 240, height: 200 } })).toBe("top-start");
    expect(flip("bottom", { trigger, panel: { width: 240, height: 200 } })).toBe("top");
  });

  it("flips top* to bottom* when the panel does not fit above and there is more room below", () => {
    const trigger: Rect = { left: 560, right: 600, top: 40, bottom: 60 };
    expect(flip("top-end", { trigger, panel: { width: 240, height: 200 } })).toBe("bottom-end");
  });

  it("flips on both axes at once for a corner-pinned trigger", () => {
    // Bottom-right corner: overflow right AND below.
    const trigger: Rect = { left: 1150, right: 1190, top: 840, bottom: 860 };
    expect(flip("bottom-start", { trigger, panel: { width: 300, height: 200 } })).toBe("top-end");
  });

  it("keeps bottom when there is no more room above than below", () => {
    const trigger: Rect = { left: 560, right: 600, top: 300, bottom: 320 };
    expect(
      flip("bottom", {
        trigger,
        panel: { width: 240, height: 2000 },
        viewport: { width: 1200, height: 700 },
      }),
    ).toBe("bottom");
  });
});
