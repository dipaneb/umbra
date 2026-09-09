import { describe, expect, it } from "vitest";
import { isToolError, toolErrorMessage, toToolError } from "./toolError";

describe("isToolError", () => {
  it("accepts a value with string code and message fields", () => {
    expect(
      isToolError({ code: "json-syntax", message: "unexpected end of input", position: null, context: null }),
    ).toBe(true);
  });

  it("rejects a plain Error instance", () => {
    expect(isToolError(new Error("boom"))).toBe(false);
  });

  it("rejects a string rejection", () => {
    expect(isToolError("boom")).toBe(false);
  });

  it("rejects an object missing the message field", () => {
    expect(isToolError({ code: "json-syntax" })).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isToolError(null)).toBe(false);
    expect(isToolError(undefined)).toBe(false);
  });
});

describe("toToolError", () => {
  it("passes an existing ToolError through unchanged", () => {
    const err = { code: "json-syntax", message: "boom", position: null, context: null };
    expect(toToolError(err)).toBe(err);
  });

  it("wraps a non-ToolError value into an unknown-code ToolError", () => {
    expect(toToolError(new Error("boom"))).toEqual({
      code: "unknown",
      message: "Error: boom",
      position: null,
      context: null,
    });
  });
});

describe("toolErrorMessage", () => {
  // Story 8.1 AC8: a JSON syntax-classification code is TRANSLATABLE_CODES-
  // registered — a stand-in `t` proves the lookup key shape without pulling
  // in a real i18n instance.
  const t = (key: string) => (key === "errors.json-expected-value" ? "translated" : key);

  it("translates a code registered in TRANSLATABLE_CODES", () => {
    const err = { code: "json-expected-value", message: "expected a value here", position: null, context: null };
    expect(toolErrorMessage(err, t)).toBe("translated");
  });

  it("falls back to the raw message for a code not registered in TRANSLATABLE_CODES", () => {
    const err = { code: "json-internal", message: "raw internal message", position: null, context: null };
    expect(toolErrorMessage(err, t)).toBe("raw internal message");
  });

  // Story 8.7 AC24/AC25/AC26. Pinned here rather than left to the OCR view's own spec: the
  // decision about which codes translate is this module's, and it is the module that would
  // silently regress if someone removed one from the set — the view would still render, just
  // in English.
  describe("the OCR codes (Story 8.7)", () => {
    const lookup = (key: string) => `translated:${key}`;

    it.each(["ocr-unsupported-format", "ocr-pdf-wrong-tool"])(
      "translates %s, whose Rust message is a fixed project-authored sentence",
      (code) => {
        const err = { code, message: "the English original", position: null, context: null };
        expect(toolErrorMessage(err, lookup)).toBe(`translated:errors.${code}`);
      },
    );

    // AC26's recorded exclusions, asserted rather than only commented. Each of these carries a
    // runtime value or third-party prose in its message, so translating off the code alone
    // would drop the number or invent the sentence.
    it.each([
      "ocr-engine-init-failed",
      "ocr-internal",
      "ocr-extraction-failed",
      "ocr-input-too-large",
      "ocr-malformed-image-buffer",
      "ocr-malformed-request",
    ])("leaves %s untranslated, falling through to the raw message", (code) => {
      const err = { code, message: "raw message with a runtime value", position: null, context: null };
      expect(toolErrorMessage(err, lookup)).toBe("raw message with a runtime value");
    });
  });
});
