import { describe, expect, it } from "vitest";
import { jsonTreeValueToText, type JsonTreeValue } from "./jsonTreeValue";

describe("jsonTreeValueToText", () => {
  it("serializes each scalar kind", () => {
    expect(jsonTreeValueToText({ kind: "Null" })).toBe("null");
    expect(jsonTreeValueToText({ kind: "Bool", data: true })).toBe("true");
    expect(jsonTreeValueToText({ kind: "String", data: 'has "quotes"' })).toBe('"has \\"quotes\\""');
  });

  it("reuses a number's exact source text unchanged, even beyond Number.MAX_SAFE_INTEGER", () => {
    expect(jsonTreeValueToText({ kind: "Number", data: "9007199254740993" })).toBe(
      "9007199254740993",
    );
  });

  it("serializes a container's children in their existing source order", () => {
    const value: JsonTreeValue = {
      kind: "Object",
      data: [
        ["b", { kind: "Number", data: "1" }],
        ["a", { kind: "Number", data: "2" }],
      ],
    };
    expect(jsonTreeValueToText(value)).toBe('{"b":1,"a":2}');
  });

  it("serializes an array preserving order", () => {
    const value: JsonTreeValue = {
      kind: "Array",
      data: [{ kind: "String", data: "x" }, { kind: "Null" }],
    };
    expect(jsonTreeValueToText(value)).toBe('["x",null]');
  });
});
