import { describe, expect, it } from "vitest";
// This project's Vitest config leaves `test.css` at its default
// (`css.include: []`), so both `?raw` and `?inline` imports of a `.css` file
// are stubbed to an empty string — verified directly against this project's
// own config, not assumed from Vite's general docs. `fs.readFileSync`
// bypasses Vite's asset pipeline entirely and reads the real file, which is
// what Task 8 actually needs.
//
// This is deliberately a source-text assertion, not a `getComputedStyle`
// runtime-resolution check: jsdom (this project's Vitest environment) does
// not reliably load external `.css` files the way a real browser does, so
// asserting on parsed source text is the honest, actually-meaningful check
// here.
//
// This project has no `@types/node`, so these Node builtins aren't typed —
// suppressed below, matching vite.config.ts's own existing precedent (it
// suppresses `process` the same way) for tolerating an untyped Node
// built-in with a targeted suppression rather than adding a devDependency
// for one test file.
// @ts-expect-error — no `@types/node` in this project; see note above.
import { readFileSync } from "node:fs";
// @ts-expect-error — no `@types/node` in this project; see note above.
import { fileURLToPath } from "node:url";
// @ts-expect-error — no `@types/node` in this project; see note above.
import { dirname, join } from "node:path";

// Not `new URL("./tokens.css", import.meta.url)` — this test runs under the
// jsdom environment, which replaces the global `URL` with its own polyfill;
// passing a jsdom URL instance to `fs.readFileSync` fails ("The URL must be
// of scheme file") because Node's fs module checks for its own `URL` class,
// not jsdom's. `node:url`'s `fileURLToPath` sidesteps the global entirely.
const tokensCssPath = join(dirname(fileURLToPath(import.meta.url)), "tokens.css");
const tokensCss = readFileSync(tokensCssPath, "utf-8");

describe("tokens.css", () => {
  it("declares the primitive custom properties every later Epic 7/8 story depends on", () => {
    const expectedProperties = [
      "--color-bg-base",
      "--color-accent-signature",
      "--font-body-size",
      "--radius-default",
      "--shadow-floating",
    ];

    for (const property of expectedProperties) {
      expect(tokensCss).toContain(`${property}:`);
    }
  });

  it("centralizes the font fallback stack in --font-sans/--font-mono, referenced by every role", () => {
    expect(tokensCss).toMatch(/--font-sans:\s*"Geist Sans"/);
    expect(tokensCss).toMatch(/--font-mono:\s*"Geist Mono"/);
    expect(tokensCss).toContain("--font-body-family: var(--font-sans)");
    expect(tokensCss).toContain("--font-code-family: var(--font-mono)");
  });

  function extractBlock(selector: string): string {
    const start = tokensCss.indexOf(selector);
    expect(start, `expected to find block "${selector}"`).toBeGreaterThan(-1);
    const openBrace = tokensCss.indexOf("{", start);
    const closeBrace = tokensCss.indexOf("}", openBrace);
    return tokensCss.slice(openBrace, closeBrace);
  }

  function extractProperties(block: string): Map<string, string> {
    const props = new Map<string, string>();
    for (const match of block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)) {
      props.set(match[1], match[2].trim());
    }
    return props;
  }

  it("declares color/shadow tokens only under [data-theme] attribute blocks, never a bare :root or a prefers-color-scheme media query", () => {
    // Guards against reintroducing the exact duplication Story 7.2's review
    // caught: a second, hand-synced copy of these values living outside the
    // attribute blocks (a bare `:root` fallback or an `@media
    // (prefers-color-scheme: dark)` block) that could silently drift from
    // the attribute blocks below.
    expect(tokensCss).not.toMatch(/@media\s*\(prefers-color-scheme/);

    const baseRootBlock = extractBlock(":root {");
    const baseRootProps = [...extractProperties(baseRootBlock).keys()];
    for (const prop of baseRootProps) {
      expect(prop).not.toMatch(/^--(color|shadow)-/);
    }
  });

  it("keeps the light and dark [data-theme] blocks declaring the same properties, aside from the documented light-only accent-signature-on-text exception", () => {
    const darkProps = extractProperties(extractBlock(':root[data-theme="dark"]'));
    const lightProps = extractProperties(extractBlock(':root[data-theme="light"]'));

    const lightOnlyException = "--color-accent-signature-on-text";
    const lightPropNames = new Set(lightProps.keys());
    lightPropNames.delete(lightOnlyException);

    expect(darkProps.has(lightOnlyException)).toBe(false);
    expect([...darkProps.keys()].sort()).toEqual([...lightPropNames].sort());
  });

  it("gives every shared color/shadow property a different value between the light and dark [data-theme] blocks", () => {
    const darkProps = extractProperties(extractBlock(':root[data-theme="dark"]'));
    const lightProps = extractProperties(extractBlock(':root[data-theme="light"]'));

    for (const [prop, darkValue] of darkProps) {
      expect(lightProps.has(prop), `light block is missing ${prop}`).toBe(true);
      expect(darkValue, `${prop} has the same value in both blocks`).not.toBe(
        lightProps.get(prop),
      );
    }
  });

  it("bundles Geist Sans/Mono locally via @import, never a remote font host", () => {
    expect(tokensCss).toContain('@import "@fontsource/geist-sans/400.css"');
    expect(tokensCss).toContain('@import "@fontsource/geist-mono/400.css"');
    expect(tokensCss).not.toMatch(/https?:\/\//);
  });
});
