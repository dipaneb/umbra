import { describe, expect, it } from "vitest";
import { ALL_ICON_NAMES, resolveIcon } from "./icons";

// `Record<IconName, Component>` already makes ICONS exhaustive at compile
// time — this test still catches an accidental `undefined` entry a typo'd
// import could produce despite type-checking cleanly against a loosely-typed
// third-party module. `ALL_ICON_NAMES` is derived from `icons.ts`'s own
// `ICONS` map, not hand-duplicated here, so a new `IconName` case can't be
// silently skipped by this test the way a hand-maintained list could.

describe("resolveIcon", () => {
  it("returns a defined component for every IconName", () => {
    for (const name of ALL_ICON_NAMES) {
      expect(resolveIcon(name)).toBeDefined();
    }
  });

  it("returns a distinct component per IconName", () => {
    const resolved = ALL_ICON_NAMES.map(resolveIcon);
    expect(new Set(resolved).size).toBe(ALL_ICON_NAMES.length);
  });
});
