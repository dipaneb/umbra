import { describe, expect, it } from "vitest";
import {
  clampPage,
  emptySelection,
  extendTo,
  isSelected,
  selectAll,
  selectOnly,
  togglePage,
} from "./pageSelection";

// AC22. Tested here rather than through the mounted view because NFR5 requires every selection
// operation to be reachable from the keyboard, and the keyboard and mouse paths call these same
// functions — proving the model once is what stops the two from drifting apart.
describe("pageSelection", () => {
  it("starts empty with no anchor", () => {
    const selection = emptySelection();

    expect(selection.pages).toEqual([]);
    expect(selection.anchor).toBeNull();
  });

  it("selects exactly one page and anchors there", () => {
    const selection = selectOnly(3);

    expect(selection.pages).toEqual([3]);
    expect(selection.anchor).toBe(3);
  });

  it("toggles a page in and out while leaving the rest alone", () => {
    let selection = selectOnly(2);
    selection = togglePage(selection, 5);
    expect(selection.pages).toEqual([2, 5]);

    selection = togglePage(selection, 2);
    expect(selection.pages).toEqual([5]);
  });

  it("keeps pages ascending however they were added", () => {
    // The verb layer turns this list straight into page numbers for the command layer, and core
    // rejects a duplicated or out-of-order selection — so order is a contract, not cosmetics.
    let selection = selectOnly(9);
    selection = togglePage(selection, 2);
    selection = togglePage(selection, 5);

    expect(selection.pages).toEqual([2, 5, 9]);
  });

  it("extends a range from the anchor in either direction", () => {
    const downward = extendTo(selectOnly(2), 5);
    expect(downward.pages).toEqual([2, 3, 4, 5]);

    const upward = extendTo(selectOnly(5), 2);
    expect(upward.pages).toEqual([2, 3, 4, 5]);
  });

  it("leaves the anchor where it was so an extension can shrink again", () => {
    // The behaviour this protects: Shift-arrow down three rows, then back up two, must leave a
    // two-row range — not five. Moving the anchor on every extension makes a range that only ever
    // grows, which is the classic wrong implementation and is invisible until someone reverses.
    let selection = selectOnly(3);
    selection = extendTo(selection, 6);
    expect(selection.pages).toEqual([3, 4, 5, 6]);

    selection = extendTo(selection, 4);
    expect(selection.pages).toEqual([3, 4]);
    expect(selection.anchor).toBe(3);
  });

  it("extends from a bare page when there is no anchor yet", () => {
    const selection = extendTo(emptySelection(), 4);

    expect(selection.pages).toEqual([4]);
    expect(selection.anchor).toBe(4);
  });

  it("selects every page in the document", () => {
    expect(selectAll(4).pages).toEqual([1, 2, 3, 4]);
  });

  it("anchors nowhere when selecting all of an empty document", () => {
    const selection = selectAll(0);

    expect(selection.pages).toEqual([]);
    expect(selection.anchor).toBeNull();
  });

  it("reports membership", () => {
    const selection = selectOnly(7);

    expect(isSelected(selection, 7)).toBe(true);
    expect(isSelected(selection, 8)).toBe(false);
  });

  it("clamps focus movement to the document's real page range", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(6, 5)).toBe(5);
    expect(clampPage(3, 5)).toBe(3);
    // A document with no pages still has to produce a usable number rather than 0 or NaN.
    expect(clampPage(2, 0)).toBe(1);
  });
});
