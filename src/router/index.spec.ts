import { describe, expect, it } from "vitest";
import { createPinia } from "pinia";
import { createAppRouter } from "./index";
import { useRegistryStore } from "../stores/registry";
import JsonView from "../tools/json/JsonView.vue";
import GridHome from "../shell/GridHome.vue";
import SettingsView from "../shell/SettingsView.vue";

describe("router", () => {
  it("resolves / to the grid-home component", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);

    await router.push("/");
    await router.isReady();

    const matched = router.currentRoute.value.matched;
    expect(matched).toHaveLength(1);
    expect(matched[0].components?.default).toBe(GridHome);
  });

  it("resolves /tools/json to the JSON tool's registered component", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);

    await router.push("/tools/json");
    await router.isReady();

    const matched = router.currentRoute.value.matched;
    expect(matched).toHaveLength(1);
    expect(matched[0].components?.default).toBe(JsonView);
  });

  it("resolves the JSON tool's route by name, matching its registry id", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);

    const resolved = router.resolve({ name: "json" });

    expect(resolved.path).toBe("/tools/json");
  });

  it("resolves /settings to SettingsView as a static route, not a registry entry", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);

    await router.push("/settings");
    await router.isReady();

    const matched = router.currentRoute.value.matched;
    expect(matched).toHaveLength(1);
    expect(matched[0].components?.default).toBe(SettingsView);

    const registry = useRegistryStore(pinia);
    expect(registry.tools).toHaveLength(7);
  });
});
