import { describe, expect, it } from "vitest";
import { assertUniqueToolIds, type ToolRegistryEntry } from "./registry";

function entry(id: string): ToolRegistryEntry {
  return {
    id,
    name: id,
    aliases: [],
    route: `/tools/${id}`,
    icon: "?",
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
