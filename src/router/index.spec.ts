import { describe, expect, it } from "vitest";
import { createPinia } from "pinia";
import { createAppRouter } from "./index";
import JsonView from "../tools/json/JsonView.vue";

describe("router", () => {
  it("resolves /tools/json to the JSON tool's registered component", async () => {
    const pinia = createPinia();
    const router = createAppRouter(pinia);

    await router.push("/tools/json");
    await router.isReady();

    const matched = router.currentRoute.value.matched;
    expect(matched).toHaveLength(1);
    expect(matched[0].components?.default).toBe(JsonView);
  });
});
