import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSettingsStore } from "../stores/settings";
import { applyResolvedTheme, attachThemeListener, resolveTheme } from "./theme";

function createFakeMediaQueryList(initialMatches: boolean) {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  return {
    matches: initialMatches,
    addEventListener: vi.fn(
      (_type: string, listener: (event: { matches: boolean }) => void) => {
        listeners.add(listener);
      },
    ),
    removeEventListener: vi.fn(
      (_type: string, listener: (event: { matches: boolean }) => void) => {
        listeners.delete(listener);
      },
    ),
    fireChange(matches: boolean): void {
      this.matches = matches;
      for (const listener of listeners) listener({ matches });
    },
  };
}

describe("resolveTheme", () => {
  it("resolves system to dark when prefersDark is true", () => {
    expect(resolveTheme("system", true)).toBe("dark");
  });

  it("resolves system to light when prefersDark is false", () => {
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("passes through light regardless of prefersDark", () => {
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("passes through dark regardless of prefersDark", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("falls back to the OS preference for an invalid override value", () => {
    expect(resolveTheme("sepia" as unknown as "system", true)).toBe("dark");
    expect(resolveTheme("sepia" as unknown as "system", false)).toBe("light");
  });
});

describe("applyResolvedTheme", () => {
  it("sets the root element's data-theme attribute", () => {
    applyResolvedTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    applyResolvedTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("attachThemeListener", () => {
  let fakeMedia: ReturnType<typeof createFakeMediaQueryList>;

  beforeEach(() => {
    setActivePinia(createPinia());
    document.documentElement.removeAttribute("data-theme");
    fakeMedia = createFakeMediaQueryList(false);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => fakeMedia),
    );
  });

  it("applies the resolved theme immediately on attach", () => {
    const settings = useSettingsStore();
    attachThemeListener(settings);

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("updates data-theme when settings.themeOverride changes", async () => {
    const settings = useSettingsStore();
    attachThemeListener(settings);

    settings.themeOverride = "dark";
    await vi.waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });

  it("updates data-theme on a system preference change while override is system", () => {
    const settings = useSettingsStore();
    attachThemeListener(settings);
    expect(document.documentElement.dataset.theme).toBe("light");

    fakeMedia.fireChange(true);

    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
