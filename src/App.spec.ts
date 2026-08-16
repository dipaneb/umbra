import { describe, expect, it } from "vitest";
// Same reasoning as src/styles/tokens.spec.ts: this project's Vitest config
// doesn't opt into `test.css` processing (Vitest's own default is
// `css.include: []`, stripping SFC <style> blocks to empty strings in
// tests), so a getComputedStyle/runtime-resolution assertion on App.vue's
// <style> block would silently test nothing. `?raw` on the SFC itself gets
// the literal source text instead — the same honest, source-text-over-
// false-confidence discipline tokens.spec.ts already applies to tokens.css.
import appVueSource from "./App.vue?raw";

describe("App.vue", () => {
  it("adopts --color-bg-base/--color-text-primary on body, as the token layer's smoke test (AC4)", () => {
    const bodyRule = /body\s*{[^}]*}/.exec(appVueSource)?.[0];

    expect(bodyRule).toBeTruthy();
    expect(bodyRule).toContain("background-color: var(--color-bg-base)");
    expect(bodyRule).toContain("color: var(--color-text-primary)");
  });

  // A missing font-family here is silent: nothing errors, the app just
  // renders in the browser/webview's default font instead of Geist — this
  // exact gap shipped once already (App.vue's body only ever set
  // background-color/color) and was only caught by a manual dev-server
  // check, not a test. Asserting on it here closes that gap.
  it("applies the body typography role's font tokens to body, so Geist actually renders (AC3)", () => {
    const bodyRule = /body\s*{[^}]*}/.exec(appVueSource)?.[0];

    expect(bodyRule).toBeTruthy();
    expect(bodyRule).toContain("font-family: var(--font-body-family)");
    expect(bodyRule).toContain("font-size: var(--font-body-size)");
    expect(bodyRule).toContain("font-weight: var(--font-body-weight)");
    expect(bodyRule).toContain("line-height: var(--font-body-line-height)");
  });
});
