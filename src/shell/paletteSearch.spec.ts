import { describe, expect, it } from "vitest";
import { searchTools } from "./paletteSearch";
import type { ToolRegistryEntry } from "../stores/registry";

const json: ToolRegistryEntry = {
  id: "json",
  name: "JSON",
  descriptionKey: "test",
  aliases: ["json", "formatter"],
  route: "/tools/json",
  icon: "json",
  component: () => Promise.resolve({ template: "<div />" }),
};

const base64: ToolRegistryEntry = {
  id: "b64",
  name: "Base64",
  descriptionKey: "test",
  aliases: ["b64"],
  route: "/tools/b64",
  icon: "base64",
  component: () => Promise.resolve({ template: "<div />" }),
};

describe("searchTools", () => {
  it("returns all tools unchanged in registry order for an empty query", () => {
    expect(searchTools([json, base64], "")).toEqual([json, base64]);
  });

  it("returns all tools unchanged in registry order for a whitespace-only query", () => {
    expect(searchTools([json, base64], "   ")).toEqual([json, base64]);
  });

  it("ranks a name match above an alias match", () => {
    const formatter: ToolRegistryEntry = {
      id: "fmt",
      name: "Formatter",
      descriptionKey: "test",
      aliases: [],
      route: "/tools/fmt",
      icon: "json",
      component: () => Promise.resolve({ template: "<div />" }),
    };

    expect(searchTools([formatter, json], "formatter")).toEqual([formatter, json]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchTools([json, base64], "zzz")).toEqual([]);
  });

  it("matches case-insensitively", () => {
    expect(searchTools([json], "JSON")).toEqual([json]);
    expect(searchTools([json], "json")).toEqual([json]);
  });

  it("matches a diacritic-free query against an accented alias, and vice versa", () => {
    const jwt: ToolRegistryEntry = {
      id: "jwt",
      name: "JWT",
      descriptionKey: "test",
      aliases: ["jwt", "jeton", "décoder"],
      route: "/tools/jwt",
      icon: "jwt",
      component: () => Promise.resolve({ template: "<div />" }),
    };

    // Typing the accent-free form matches the accented alias…
    expect(searchTools([jwt], "decoder")).toEqual([jwt]);
    // …and typing the accented form still matches too.
    expect(searchTools([jwt], "décoder")).toEqual([jwt]);
  });

  it("ranks an alias startsWith match above a name.includes match", () => {
    // base64: alias "b64" startsWith "b6" -> tier 3
    // cb6x:   name "Cb6x" includes "b6" (but no name/alias startsWith) -> tier 4
    const cb6x: ToolRegistryEntry = {
      id: "cb6x",
      name: "Cb6x",
      descriptionKey: "test",
      aliases: [],
      route: "/tools/cb6x",
      icon: "hash",
      component: () => Promise.resolve({ template: "<div />" }),
    };

    expect(searchTools([cb6x, base64], "b6")).toEqual([base64, cb6x]);
  });
});
