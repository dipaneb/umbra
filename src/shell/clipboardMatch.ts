// AC2/AC11/AC12: pure, synchronous, local shape classification for the clipboard-suggestion
// surface — no IPC round trip, no parsing library, nothing beyond built-in `JSON.parse`/string
// methods (AC2's "no new dependency", scoped to this file — see the story's Dev Notes for why
// that doesn't also cover AC13's separately-licensed Rust watcher dependency). These predicates
// only classify a *shape*; the matched tool re-validates fully on open, which is what makes a
// false positive (AC11) land as that tool's own precise inline-error state, not a crash here.

// AC12: no source doc spells out `test`'s exact content-type shape (epics.md's literal
// `test: (content) => boolean` signature leaves `content` untyped) — this discriminated union is
// this story's resolved interpretation, chosen because it's the smallest shape that lets an
// image-eligible tool (Bucket) and every text-shape tool share one `test` signature without
// either side needing to know the other exists.
export type ClipboardContent = { kind: "text"; value: string } | { kind: "image" };

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

function isJwtShaped(value: string): boolean {
  const segments = value.split(".");
  return segments.length === 3 && segments.every((segment) => segment.length > 0 && BASE64URL_SEGMENT.test(segment));
}

function isJsonShaped(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

// Deliberately loosens epics.md's literal "valid padding" AC2 wording to match
// crates/umbra-core/src/base64.rs's actual decoder tolerance (`DecodePaddingMode::Indifferent`)
// — see the story's Dev Notes for the full disclosed reasoning. Mirrors that decoder's own
// alphabet-selection rule: presence of '-'/'_' picks the URL-safe alphabet, everything else uses
// the standard one; both tolerate absent/partial padding, and at least one non-padding character
// is required (rejects a whitespace-only or padding-only clipboard entry).
const BASE64_STANDARD_SHAPE = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64_URL_SAFE_SHAPE = /^[A-Za-z0-9_-]+={0,2}$/;

// Review finding (2026-08-18): the alphabet check alone matches any ordinary short word or
// filename (e.g. "hello"), since it has no minimum length or case/digit variety requirement.
// A `=` padding suffix is a strong, distinctive signal on its own — plain text essentially
// never ends in it — so it bypasses the length/diversity gate below entirely. Deliberately
// simple (a length + character-diversity heuristic, not entropy/dictionary analysis) per
// developer direction; clipboard content detection is flagged for a more thorough rework later.
const BASE64_MIN_LENGTH_UNPADDED = 8;

function hasSufficientCharacterDiversity(value: string): boolean {
  const categories = [/[0-9]/, /[A-Z]/, /[a-z]/].filter((pattern) => pattern.test(value));
  return categories.length >= 2;
}

function isBase64Shaped(value: string): boolean {
  const cleaned = value.replace(/\s+/g, "");
  if (cleaned.length === 0) return false;
  const urlSafeAlphabet = cleaned.includes("-") || cleaned.includes("_");
  if (!(urlSafeAlphabet ? BASE64_URL_SAFE_SHAPE : BASE64_STANDARD_SHAPE).test(cleaned)) return false;
  if (cleaned.endsWith("=")) return true;
  return cleaned.length >= BASE64_MIN_LENGTH_UNPADDED && hasSufficientCharacterDiversity(cleaned);
}

export function matchesJwt(content: ClipboardContent): boolean {
  return content.kind === "text" && isJwtShaped(content.value);
}

export function matchesJson(content: ClipboardContent): boolean {
  return content.kind === "text" && isJsonShaped(content.value);
}

export function matchesBase64(content: ClipboardContent): boolean {
  return content.kind === "text" && isBase64Shaped(content.value);
}

// AC12: format-only — `content.kind === "image"` never reads pixel data itself; the caller
// (AppSidebar.vue, Task 7) constructs this case directly from the watcher's event payload,
// never via `readClipboardImage()`.
export function matchesImage(content: ClipboardContent): boolean {
  return content.kind === "image";
}
