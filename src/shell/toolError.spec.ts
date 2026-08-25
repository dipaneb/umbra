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
});
