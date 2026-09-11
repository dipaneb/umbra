// The page list's selection model (AC22), kept as pure functions over a plain value rather than
// as refs inside the view. NFR5 admits no exceptions — every selection operation has to be
// reachable from the keyboard — and the surest way to get that right is to make the model
// testable without mounting anything, so the keyboard path and the mouse path provably share one
// implementation instead of drifting into two.
//
// Follows the `CronFieldEditor.vue` / `overlayGeometry.ts` precedent for island helpers.

export interface PageSelection {
  /**
   * The page a range extension grows from — set by any plain click or toggle, and deliberately
   * NOT moved by a Shift-extension. That is what lets a user Shift-arrow out past a page and back
   * again and get the range they expect, rather than a range that grows and never shrinks.
   */
  anchor: number | null;
  /** 1-indexed page numbers, ascending and duplicate-free. */
  pages: number[];
}

export function emptySelection(): PageSelection {
  return { anchor: null, pages: [] };
}

export function isSelected(selection: PageSelection, page: number): boolean {
  return selection.pages.includes(page);
}

/** Replaces the selection with exactly this page — a plain click, or `Space` on an unselected row. */
export function selectOnly(page: number): PageSelection {
  return { anchor: page, pages: [page] };
}

/** Adds or removes one page, leaving the rest alone — `Space`, or ⌘/Ctrl-click. */
export function togglePage(selection: PageSelection, page: number): PageSelection {
  const pages = isSelected(selection, page)
    ? selection.pages.filter((candidate) => candidate !== page)
    : [...selection.pages, page].sort((a, b) => a - b);
  return { anchor: page, pages };
}

/**
 * Extends from the anchor to `page` inclusive — Shift-click and Shift-arrow.
 *
 * Replaces the range rather than unioning with it, which is what makes a shrinking extension work:
 * Shift-arrow down three rows then back up two must leave one row selected, not three.
 */
export function extendTo(selection: PageSelection, page: number): PageSelection {
  if (selection.anchor === null) return selectOnly(page);
  const start = Math.min(selection.anchor, page);
  const end = Math.max(selection.anchor, page);
  const pages: number[] = [];
  for (let candidate = start; candidate <= end; candidate += 1) pages.push(candidate);
  return { anchor: selection.anchor, pages };
}

/** ⌘A / Ctrl-A while focus is inside the list. */
export function selectAll(totalPages: number): PageSelection {
  const pages: number[] = [];
  for (let page = 1; page <= totalPages; page += 1) pages.push(page);
  return { anchor: pages.length > 0 ? 1 : null, pages };
}

/**
 * Clamps a would-be focus move to the document, so arrowing past either end parks on the last
 * real row instead of running off into a page number that does not exist.
 */
export function clampPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 1;
  return Math.min(Math.max(page, 1), totalPages);
}

/**
 * The pages remaining after `removed` are deleted, renumbered to their new positions.
 *
 * Deleting pages shifts every later page down, so a selection held across the operation would
 * otherwise point at the wrong rows — silently, and only for the pages after the first deletion.
 */
export function renumberAfterDelete(totalPages: number, removed: number[]): number[] {
  const gone = new Set(removed);
  const remaining: number[] = [];
  for (let page = 1; page <= totalPages; page += 1) {
    if (!gone.has(page)) remaining.push(page);
  }
  return remaining;
}
