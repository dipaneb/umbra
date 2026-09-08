import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyFeedback } from "./useCopyFeedback";

// The composable's 1500ms window is a private constant, so these tests drive it
// through the public surface with fake timers rather than importing the value —
// the same shape debounce.spec.ts uses for its own delay.
const FEEDBACK_DURATION_MS = 1500;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCopyFeedback", () => {
  it("reports no key as copied before anything is marked", () => {
    const { isCopied } = useCopyFeedback();

    expect(isCopied("a")).toBe(false);
    expect(isCopied("")).toBe(false);
  });

  it("marks only the exact key that was copied, so sibling copy buttons stay unconfirmed", () => {
    const { isCopied, markCopied } = useCopyFeedback();

    markCopied("$.user.name:value");

    expect(isCopied("$.user.name:value")).toBe(true);
    expect(isCopied("$.user.name:path")).toBe(false);
    expect(isCopied("$.user.email:value")).toBe(false);
  });

  it("clears the confirmation once the feedback window elapses", () => {
    const { isCopied, markCopied } = useCopyFeedback();

    markCopied("a");
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS - 1);
    expect(isCopied("a")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(isCopied("a")).toBe(false);
  });

  it("restarts the window when a second key is copied, and only the newer key is confirmed", () => {
    const { isCopied, markCopied } = useCopyFeedback();

    markCopied("first");
    vi.advanceTimersByTime(1000);
    markCopied("second");

    // The first key's original timeout would have fired at 1500ms; marking the
    // second key must have cancelled it rather than leaving it to clear the
    // newer confirmation early.
    vi.advanceTimersByTime(500);
    expect(isCopied("first")).toBe(false);
    expect(isCopied("second")).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(isCopied("second")).toBe(false);
  });

  it("cancel() clears the confirmation immediately and leaves no timeout to fire", () => {
    const { isCopied, markCopied, cancel } = useCopyFeedback();

    markCopied("a");
    cancel();
    expect(isCopied("a")).toBe(false);

    // Nothing pending: advancing past the window must not resurrect or re-clear
    // anything, which is what the onUnmounted callers rely on.
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS);
    expect(isCopied("a")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("is safe to cancel when nothing was ever copied", () => {
    const { isCopied, cancel } = useCopyFeedback();

    expect(() => cancel()).not.toThrow();
    expect(isCopied("a")).toBe(false);
  });

  it("gives each caller its own independent state, so two views never confirm each other's buttons", () => {
    const a = useCopyFeedback();
    const b = useCopyFeedback();

    a.markCopied("shared-key");

    expect(a.isCopied("shared-key")).toBe(true);
    expect(b.isCopied("shared-key")).toBe(false);
  });
});
