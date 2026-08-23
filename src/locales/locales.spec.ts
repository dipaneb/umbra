import { describe, expect, it } from "vitest";
import en from "./en.json";
import fr from "./fr.json";

// The acceptance gate for this app's whole i18n approach (per AD-13's
// "ships as one unit or not at all" spirit, applied here to the UI itself):
// a French key silently missing would fall back to English at runtime
// (i18n.ts's fallbackLocale) rather than fail loudly, so nothing else would
// ever catch a half-translated release. This test is the thing that does.

type MessageTree = { [key: string]: string | MessageTree };

// Collects every leaf key as a dot-path (e.g. "shell.settings.theme") and,
// for string leaves, the set of `{placeholder}` names it interpolates —
// vue-i18n's literal-interpolation escape (`{'{'}`) means a bare `{` is
// never actually a placeholder, so this specifically excludes any `{...}`
// immediately followed by `{'` from being counted as one.
function collect(tree: MessageTree, prefix = ""): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      const placeholders = new Set(
        [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]),
      );
      result.set(path, placeholders);
    } else {
      for (const [childPath, childPlaceholders] of collect(value, path)) {
        result.set(childPath, childPlaceholders);
      }
    }
  }
  return result;
}

const enKeys = collect(en);
const frKeys = collect(fr);

describe("locale key parity (en.json vs fr.json)", () => {
  it("has no key present in en.json but missing from fr.json", () => {
    const missing = [...enKeys.keys()].filter((key) => !frKeys.has(key));
    expect(missing).toEqual([]);
  });

  it("has no key present in fr.json but absent from en.json (a stale/orphaned key)", () => {
    const extra = [...frKeys.keys()].filter((key) => !enKeys.has(key));
    expect(extra).toEqual([]);
  });

  it("has no empty string value in either locale", () => {
    const emptyIn = (keys: Map<string, Set<string>>, tree: MessageTree) => {
      const empty: string[] = [];
      for (const key of keys.keys()) {
        const value = key.split(".").reduce<unknown>((node, segment) => {
          return typeof node === "object" && node !== null
            ? (node as Record<string, unknown>)[segment]
            : undefined;
        }, tree);
        if (value === "") empty.push(key);
      }
      return empty;
    };

    expect(emptyIn(enKeys, en)).toEqual([]);
    expect(emptyIn(frKeys, fr)).toEqual([]);
  });

  it("has matching interpolation placeholders between en and fr for every shared key", () => {
    const mismatches: string[] = [];
    for (const [key, enPlaceholders] of enKeys) {
      const frPlaceholders = frKeys.get(key);
      if (!frPlaceholders) continue; // already reported by the "missing" test above
      const enSorted = [...enPlaceholders].sort();
      const frSorted = [...frPlaceholders].sort();
      if (enSorted.join(",") !== frSorted.join(",")) {
        mismatches.push(`${key}: en=[${enSorted}] fr=[${frSorted}]`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
