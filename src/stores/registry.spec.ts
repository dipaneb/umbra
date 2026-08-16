import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { assertUniqueToolIds, useRegistryStore, type ToolRegistryEntry } from "./registry";
import { resolveIcon } from "../shell/icons";

function entry(id: string): ToolRegistryEntry {
  return {
    id,
    name: id,
    aliases: [],
    route: `/tools/${id}`,
    icon: "json",
    component: () => Promise.reject(new Error("not used in this test")),
  };
}

describe("assertUniqueToolIds", () => {
  it("does not throw when all ids are unique", () => {
    expect(() =>
      assertUniqueToolIds([entry("json"), entry("base64")]),
    ).not.toThrow();
  });

  it("throws immediately on a colliding id", () => {
    expect(() =>
      assertUniqueToolIds([entry("json"), entry("base64"), entry("json")]),
    ).toThrow('Duplicate tool registry id(s): "json"');
  });

  it("reports every colliding id when there are multiple", () => {
    expect(() =>
      assertUniqueToolIds([
        entry("json"),
        entry("json"),
        entry("base64"),
        entry("base64"),
      ]),
    ).toThrow('Duplicate tool registry id(s): "json", "base64"');
  });

  it("does not throw for an empty registry", () => {
    expect(() => assertUniqueToolIds([])).not.toThrow();
  });
});

describe("TOOLS icon field (AC5)", () => {
  it("resolves a real icon component for every registry entry's icon", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();

    registry.tools.forEach((tool) => {
      expect(resolveIcon(tool.icon)).toBeDefined();
    });
  });
});

describe("getLatestWinsRunner", () => {
  it("returns the same runner instance for repeated calls with the same toolId", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();
    expect(registry.getLatestWinsRunner("hash")).toBe(registry.getLatestWinsRunner("hash"));
  });

  it("returns independent runners for different toolIds (no cross-tool supersession)", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();
    expect(registry.getLatestWinsRunner("hash")).not.toBe(registry.getLatestWinsRunner("base64"));
  });

  it("shares one latest-wins sequence across independent callers for the same tool, so a manual invoke and a file drop can't overwrite each other out of order", async () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();

    let resolveManualCompute: (value: string) => void;
    const manualCompute = new Promise<string>((resolve) => {
      resolveManualCompute = resolve;
    });
    let resolveDrop: (value: string) => void;
    const drop = new Promise<string>((resolve) => {
      resolveDrop = resolve;
    });

    // Simulates HashView's onCompute() call site...
    const manualResultPromise = registry.getLatestWinsRunner("hash")(() => manualCompute);
    // ...and DropZone.vue's drop-dispatch call site, obtained independently.
    const dropResultPromise = registry.getLatestWinsRunner("hash")(() => drop);

    // The drop (dispatched second) resolves first...
    resolveDrop!("drop-result");
    // ...then the manual compute (dispatched first) resolves after it.
    resolveManualCompute!("manual-result");

    const [manualResult, dropResult] = await Promise.all([manualResultPromise, dropResultPromise]);

    expect(manualResult).toEqual({ superseded: true });
    expect(dropResult).toEqual({ superseded: false, value: "drop-result" });
  });
});
