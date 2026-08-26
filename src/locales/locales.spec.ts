import { describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";
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

  // Regression: a message string describing JSON syntax can contain a bare
  // `}` (e.g. "...missing a closing }.") that reads as plain English but is
  // NOT plain text to vue-i18n — its compiler treats `{`/`}` as interpolation
  // syntax, so a lone unmatched brace throws "Unbalanced closing brace" the
  // first time that key is actually rendered, not at build time (`pnpm
  // build`/`vue-tsc` never touch message *content*, only that the JSON
  // parses). This slipped past every other check in Story 8.1's Validate
  // slice — found live, in the real app, only because a user's JSON syntax
  // error happened to be exactly the one message with an unescaped `}`. The
  // real i18n compiler (not a placeholder regex) is the only thing that
  // actually proves a message is safe to render — it's what threw for the
  // user, so it's what has to pass here.
  it("compiles every message in both locales without throwing (unescaped brace regression)", () => {
    const testI18n = createI18n({
      legacy: false,
      locale: "en",
      fallbackLocale: "en",
      messages: { en, fr },
    });

    const failures: string[] = [];
    for (const [locale, keys] of [["en", enKeys], ["fr", frKeys]] as const) {
      testI18n.global.locale.value = locale;
      for (const key of keys.keys()) {
        try {
          testI18n.global.t(key);
        } catch (err) {
          failures.push(`${locale}:${key}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
