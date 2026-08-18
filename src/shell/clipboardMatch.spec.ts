import { describe, expect, it } from "vitest";
import { matchesBase64, matchesImage, matchesJson, matchesJwt } from "./clipboardMatch";

const text = (value: string) => ({ kind: "text" as const, value });
const image = { kind: "image" as const };

describe("matchesJwt", () => {
  it("matches a well-formed JWT shape", () => {
    expect(
      matchesJwt(
        text(
          "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGhpc19pc19hX3NpZ25hdHVyZQ",
        ),
      ),
    ).toBe(true);
  });

  it("rejects three dot-separated segments that aren't valid base64url (AC11)", () => {
    expect(matchesJwt(text("has spaces.and!bang.chars$here"))).toBe(false);
  });

  it("accepts a base64url-shaped-but-not-a-real-JWT string — a genuine false positive left to AC11", () => {
    // Three non-empty, base64url-alphabet segments: shape-valid by this predicate's own contract,
    // even though it decodes to nothing meaningful — the matched tool's own open-time validation
    // is what's expected to catch that, per this story's AC11.
    expect(matchesJwt(text("abc.def.ghi"))).toBe(true);
  });

  it("rejects content with an empty segment", () => {
    expect(matchesJwt(text("abc..def"))).toBe(false);
  });

  it("rejects content with the wrong number of segments", () => {
    expect(matchesJwt(text("abc.def"))).toBe(false);
    expect(matchesJwt(text("abc.def.ghi.jkl"))).toBe(false);
  });

  it("rejects image content", () => {
    expect(matchesJwt(image)).toBe(false);
  });
});

describe("matchesJson", () => {
  it("matches an object", () => {
    expect(matchesJson(text('{"a":1}'))).toBe(true);
  });

  it("matches an array, a bare string, a number, and null", () => {
    expect(matchesJson(text("[1,2,3]"))).toBe(true);
    expect(matchesJson(text('"just a string"'))).toBe(true);
    expect(matchesJson(text("42"))).toBe(true);
    expect(matchesJson(text("null"))).toBe(true);
  });

  it("rejects malformed JSON", () => {
    expect(matchesJson(text("{a:1}"))).toBe(false);
    expect(matchesJson(text("not json at all"))).toBe(false);
  });

  it("rejects image content", () => {
    expect(matchesJson(image)).toBe(false);
  });
});

describe("matchesBase64", () => {
  it("matches padded and unpadded input identically (tolerant, per base64.rs's own decoder)", () => {
    expect(matchesBase64(text("SGVsbG8gd29ybGQ="))).toBe(true);
    expect(matchesBase64(text("SGVsbG8gd29ybGQ"))).toBe(true);
  });

  it("matches URL-safe alphabet content", () => {
    expect(matchesBase64(text("abc_123-XYZ"))).toBe(true);
  });

  it("tolerates whitespace/line-wraps, mirroring the real decoder's own tolerance", () => {
    expect(matchesBase64(text("SGVs bG8g\nd29ybGQ="))).toBe(true);
  });

  it("rejects alphabet-invalid content", () => {
    expect(matchesBase64(text("Hello World!"))).toBe(false);
  });

  it("rejects content with more than two padding characters", () => {
    expect(matchesBase64(text("QQ==="))).toBe(false);
  });

  it("rejects an empty or whitespace-only/padding-only string", () => {
    expect(matchesBase64(text(""))).toBe(false);
    expect(matchesBase64(text("   "))).toBe(false);
    expect(matchesBase64(text("=="))).toBe(false);
  });

  it("rejects image content", () => {
    expect(matchesBase64(image)).toBe(false);
  });

  // Review finding (2026-08-18): the alphabet check alone matched any ordinary short word —
  // a minimum length + character-diversity gate narrows that down, with a `=` padding suffix
  // as a strong override signal.
  it("rejects short, single-case words that happen to be alphabet-valid", () => {
    expect(matchesBase64(text("hello"))).toBe(false);
    expect(matchesBase64(text("filename"))).toBe(false);
  });

  it("rejects a longer single-case run lacking character diversity", () => {
    expect(matchesBase64(text("helloworldagain"))).toBe(false);
  });

  it("matches a short padded string even though it's below the unpadded length gate", () => {
    expect(matchesBase64(text("dGVzdA=="))).toBe(true);
  });

  it("matches a long-enough unpadded string with sufficient character diversity", () => {
    expect(matchesBase64(text("aZ9bY8cX7"))).toBe(true);
  });
});

describe("matchesImage", () => {
  it("matches image content", () => {
    expect(matchesImage(image)).toBe(true);
  });

  it("rejects text content", () => {
    expect(matchesImage(text("anything"))).toBe(false);
  });
});
