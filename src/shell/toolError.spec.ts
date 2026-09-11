import { describe, expect, it } from "vitest";
import { isToolError, toolErrorMessage, toToolError, TRANSLATABLE_CODES } from "./toolError";
import en from "../locales/en.json";
import fr from "../locales/fr.json";

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

  // Story 8.8 AC38. The PDF codes are the first in this codebase to translate WITH params: AC14
  // moved their runtime values out of the message prose and into the structured `context` field,
  // which is the only reason they are eligible at all — without params a French user would read a
  // sentence stripped of the numbers the English one carried.
  describe("the PDF codes (Story 8.8)", () => {
    const lookup = (key: string) => `translated:${key}`;

    it.each([
      "pdf-encrypted",
      "pdf-invalid-range",
      "pdf-too-few-files",
      "pdf-cannot-delete-all-pages",
    ])("translates %s", (code) => {
      const err = { code, message: "the English original", position: null, context: null };
      expect(toolErrorMessage(err, lookup)).toBe(`translated:errors.${code}`);
    });

    it("passes a JSON context object to t() as interpolation params", () => {
      const seen: Array<[string, Record<string, unknown> | undefined]> = [];
      const spy = (key: string, params?: Record<string, unknown>) => {
        seen.push([key, params]);
        return "ok";
      };

      toolErrorMessage(
        {
          code: "pdf-invalid-range",
          message: "the requested page range does not exist in this document",
          position: null,
          context: JSON.stringify({ startPage: 5, endPage: 5, totalPages: 3 }),
        },
        spy,
      );

      expect(seen).toEqual([
        ["errors.pdf-invalid-range", { startPage: 5, endPage: 5, totalPages: 3 }],
      ]);
    });

    it("passes the merge count through for pdf-too-few-files", () => {
      const spy = (_key: string, params?: Record<string, unknown>) => String(params?.count);

      expect(
        toolErrorMessage(
          {
            code: "pdf-too-few-files",
            message: "merge requires at least 2 PDFs",
            position: null,
            context: JSON.stringify({ count: 1 }),
          },
          spy,
        ),
      ).toBe("1");
    });

    // `context` is a SHARED field with a per-tool convention, not a JSON contract: `jwt.rs` writes
    // prose into it ("segment: header"), and AD-3 makes that shape binding for every tool. A bare
    // JSON.parse here would throw on a JWT error and take the whole error message down with it —
    // turning a tool's error into a blank pane, which is the NFR4 failure the error path exists to
    // prevent.
    it("survives a context that is prose rather than JSON, passing no params", () => {
      const seen: Array<Record<string, unknown> | undefined> = [];
      const spy = (_key: string, params?: Record<string, unknown>) => {
        seen.push(params);
        return "ok";
      };

      expect(() =>
        toolErrorMessage(
          { code: "pdf-encrypted", message: "raw", position: null, context: "segment: header" },
          spy,
        ),
      ).not.toThrow();
      expect(seen).toEqual([undefined]);
    });

    // Valid JSON, but not an object — spreading it into t() params would hand vue-i18n a shape it
    // cannot interpolate from.
    it.each(["5", '"text"', "null", "[1,2]"])(
      "passes no params for a context that parses to %s rather than an object",
      (context) => {
        const seen: Array<Record<string, unknown> | undefined> = [];
        const spy = (_key: string, params?: Record<string, unknown>) => {
          seen.push(params);
          return "ok";
        };

        toolErrorMessage({ code: "pdf-encrypted", message: "raw", position: null, context }, spy);

        expect(seen).toEqual([undefined]);
      },
    );

    // AC38's recorded exclusions, asserted rather than only commented — the same treatment AC26's
    // got, for the same reason: a comment cannot fail.
    it.each(["pdf-corrupt", "pdf-input-too-large", "pdf-internal", "pdf-render-unavailable"])(
      "leaves %s untranslated, falling through to the raw message",
      (code) => {
        const err = { code, message: "raw message with third-party prose", position: null, context: null };
        expect(toolErrorMessage(err, lookup)).toBe("raw message with third-party prose");
      },
    );
  });

  // Nothing caught this before: adding a code to TRANSLATABLE_CODES without adding its locale key
  // makes `t()` return the key path, so the user reads a literal "errors.pdf-encrypted" in the UI
  // — in BOTH locales, so `locales.spec.ts`'s en/fr parity check stays green throughout.
  describe("every translatable code has a locale key (both locales)", () => {
    const errorsIn = (tree: { errors: Record<string, string> }) => tree.errors;

    it.each([...TRANSLATABLE_CODES])("en.json defines errors.%s", (code) => {
      expect(errorsIn(en)[code]).toBeTruthy();
    });

    it.each([...TRANSLATABLE_CODES])("fr.json defines errors.%s", (code) => {
      expect(errorsIn(fr)[code]).toBeTruthy();
    });
  });
});
