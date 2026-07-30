import { describe, expect, it } from "vitest";
import { isToolError, toToolError } from "./toolError";

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
