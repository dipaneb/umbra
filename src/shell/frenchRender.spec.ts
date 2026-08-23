// A French-locale render pass over the shell's most visible surfaces:
// AppSidebar, SettingsView, UpdateDialog, CommandPalette. Every other spec
// file in this codebase asserts against English (vitest.setup.ts pins the
// test-wide default to "en" so ~107 pre-existing assertions/selectors stay
// valid unchanged) — this file is deliberately the one place that flips the
// switch and confirms French actually renders, rather than just existing in
// en.json/fr.json with matching keys (locales.spec.ts already checks that).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createAppRouter } from "../router";
import { useSettingsStore } from "../stores/settings";
import { i18n } from "../i18n";
import AppSidebar from "./AppSidebar.vue";
import SettingsView from "./SettingsView.vue";
import UpdateDialog from "./UpdateDialog.vue";
import CommandPalette from "./CommandPalette.vue";
import { __setDialogOpenForTest, __setPendingUpdateForTest } from "./updateSignal";
import type { Update } from "./updateCheck";

// AppSidebar listens for clipboard changes on mount (clipboard.ts wraps
// @tauri-apps/api/event's listen) — unmocked, this throws in jsdom (no real
// Tauri IPC bridge). Mirrors AppSidebar.spec.ts's own mock exactly.
const listen = vi.fn(() => Promise.resolve(vi.fn()));
vi.mock("@tauri-apps/api/event", () => ({
  listen: () => listen(),
}));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn().mockResolvedValue(""),
}));

function fakeUpdate(overrides: Record<string, unknown> = {}) {
  return {
    version: "1.1.0",
    currentVersion: "1.0.0",
    date: "2026-08-09",
    body: "Bug fixes and improvements.",
    close: () => Promise.resolve(),
    ...overrides,
  } as unknown as Update;
}

beforeEach(() => {
  i18n.global.locale.value = "fr";
});

afterEach(() => {
  i18n.global.locale.value = "en";
  __setPendingUpdateForTest(null);
  __setDialogOpenForTest(false);
});

describe("French locale render pass", () => {
  it("AppSidebar renders French section headings and the Settings label", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/tools/json");
    await router.isReady();

    const wrapper = mount(AppSidebar, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.text()).toContain("Tous les outils");
    expect(wrapper.text()).toContain("Réglages");
    // English strings must not leak through under fr.
    expect(wrapper.text()).not.toContain("All tools");
    expect(wrapper.text()).not.toContain("Settings");
  });

  it("SettingsView renders French labels, including the new Language/Date-time rows", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const settings = useSettingsStore(pinia);
    settings.entries = vi.fn().mockResolvedValue([]);

    const wrapper = mount(SettingsView);
    await flushPromises();

    expect(wrapper.text()).toContain("Réglages");
    expect(wrapper.text()).toContain("Apparence");
    expect(wrapper.text()).toContain("Confidentialité");
    expect(wrapper.find('select[aria-label="Langue"]').exists()).toBe(true);
    expect(wrapper.find('select[aria-label="Date et heure"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Settings");
  });

  it("UpdateDialog renders French button labels and the update heading", async () => {
    setActivePinia(createPinia());
    __setPendingUpdateForTest(fakeUpdate());
    __setDialogOpenForTest(true);

    const wrapper = mount(UpdateDialog, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.text()).toContain("Pas maintenant");
    expect(wrapper.text()).toContain("Installer et redémarrer");
    expect(wrapper.text()).toContain("Mise à jour disponible");
    wrapper.unmount();
  });

  it("CommandPalette renders the French search placeholder and no-match message", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);
    router.push("/");
    await router.isReady();

    const wrapper = mount(CommandPalette, {
      global: { plugins: [pinia, router] },
      attachTo: document.body,
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    await flushPromises();

    expect(wrapper.find("input").attributes("placeholder")).toBe(
      "Rechercher par nom ou alias…",
    );

    await wrapper.find("input").setValue("zzzznomatch");
    await flushPromises();
    expect(wrapper.text()).toContain("Aucun outil ne correspond à");
    wrapper.unmount();
  });
});
