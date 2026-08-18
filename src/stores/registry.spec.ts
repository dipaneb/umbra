import { describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { assertUniqueToolIds, useRegistryStore, type ToolRegistryEntry } from "./registry";
import { resolveIcon } from "../shell/icons";

function entry(id: string): ToolRegistryEntry {
  return {
    id,
    name: id,
    description: "test",
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

describe("TOOLS description field (AC4)", () => {
  it("gives every registry entry a non-empty description", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();

    registry.tools.forEach((tool) => {
      expect(tool.description).toBeTruthy();
    });
  });
});

describe("TOOLS clipboardMatch field (AC3/AC4/AC12, Story 7.8)", () => {
  const text = (value: string) => ({ kind: "text" as const, value });
  const image = { kind: "image" as const };

  it("declares clipboardMatch on exactly the four eligible tools, undefined on the rest", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();
    const eligible = registry.tools
      .filter((tool) => tool.clipboardMatch !== undefined)
      .map((tool) => tool.id)
      .sort();

    expect(eligible).toEqual(["base64", "bucket", "json", "jwt"]);
  });

  it("does not crash iterating a mixed registry (some entries have no clipboardMatch)", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();

    expect(() =>
      registry.tools.map((tool) => tool.clipboardMatch?.test(text("anything")) ?? false),
    ).not.toThrow();
  });

  it("jwt matches a JWT-shaped string", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();
    const jwt = registry.tools.find((tool) => tool.id === "jwt")!;

    expect(jwt.clipboardMatch!.test(text("a.b.c"))).toBe(true);
    expect(jwt.clipboardMatch!.test(text("not-jwt-shaped"))).toBe(false);
  });

  it("json matches a JSON-parseable string", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();
    const json = registry.tools.find((tool) => tool.id === "json")!;

    expect(json.clipboardMatch!.test(text('{"a":1}'))).toBe(true);
    expect(json.clipboardMatch!.test(text("{not json"))).toBe(false);
  });

  it("base64 matches base64-alphabet content", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();
    const base64 = registry.tools.find((tool) => tool.id === "base64")!;

    expect(base64.clipboardMatch!.test(text("SGVsbG8="))).toBe(true);
    expect(base64.clipboardMatch!.test(text("not valid!"))).toBe(false);
  });

  it("bucket matches image content only, never text", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();
    const bucket = registry.tools.find((tool) => tool.id === "bucket")!;

    expect(bucket.clipboardMatch!.test(image)).toBe(true);
    expect(bucket.clipboardMatch!.test(text("anything"))).toBe(false);
  });

  it("orders specificity so jwt > json > base64, and bucket's image match can never collide with a text matcher", () => {
    setActivePinia(createPinia());
    const registry = useRegistryStore();
    const byId = Object.fromEntries(registry.tools.map((tool) => [tool.id, tool.clipboardMatch]));

    expect(byId.jwt!.specificity).toBeGreaterThan(byId.json!.specificity);
    expect(byId.json!.specificity).toBeGreaterThan(byId.base64!.specificity);
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
