import { describe, expect, it } from "vitest";
import { jsonPathFromSegments } from "./jsonPath";

describe("jsonPathFromSegments", () => {
  it("renders the root as just $", () => {
    expect(jsonPathFromSegments([])).toBe("$");
  });

  it("uses dot notation for identifier-shaped keys", () => {
    expect(jsonPathFromSegments(["data", "user", "email"])).toBe("$.data.user.email");
  });

  it("uses bracket notation for array indices", () => {
    expect(jsonPathFromSegments(["data", 3, "user"])).toBe("$.data[3].user");
  });

  it("falls back to quoted bracket notation for a non-identifier key", () => {
    expect(jsonPathFromSegments(["a.b"])).toBe('$["a.b"]');
    expect(jsonPathFromSegments(["1st"])).toBe('$["1st"]');
    expect(jsonPathFromSegments(["has space"])).toBe('$["has space"]');
  });
});
