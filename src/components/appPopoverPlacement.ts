// Viewport-aware placement flipping for AppPopover. Pure, no DOM, no Vue —
// the component gathers the rects and calls `flipPlacement`; this file is the
// unit-tested decision (mirrors how locale.ts / theme.ts keep their resolvers
// pure and testable).
//
// Story 8.3 shipped AppPopover with six fixed placements and NO measurement
// ("if a placement clips, the consumer picks another"). Story 8.5's JWT `?`
// sits at the end of a caption line hard against the pane's right edge, where
// no single fixed placement fits at every window width. So the `placement`
// prop is now a *preferred* hint: this flips it to the opposite side of an
// axis when the panel would overflow the viewport on that side AND the
// opposite side has room. It never invents a placement the prop couldn't
// already express, and it stays purely CSS-positioned (no positioning lib).

export type Placement =
  | "bottom-start"
  | "bottom"
  | "bottom-end"
  | "top-start"
  | "top"
  | "top-end";

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

// px of breathing room kept between the panel and the viewport edge.
export const VIEWPORT_MARGIN = 8;

export function flipPlacement(
  preferred: Placement,
  trigger: Rect,
  panel: Size,
  viewport: Size,
  margin: number = VIEWPORT_MARGIN,
): Placement {
  let placement = preferred;

  // Horizontal. `-start` pins the panel's left edge to the trigger's left and
  // grows right; `-end` pins its right edge to the trigger's right and grows
  // left. Flip only when the current side overflows AND the flipped side fits.
  if (placement.endsWith("-start")) {
    const overflowsRight = trigger.left + panel.width > viewport.width - margin;
    const flippedFits = trigger.right - panel.width >= margin;
    if (overflowsRight && flippedFits) {
      placement = placement.replace("-start", "-end") as Placement;
    }
  } else if (placement.endsWith("-end")) {
    const overflowsLeft = trigger.right - panel.width < margin;
    const flippedFits = trigger.left + panel.width <= viewport.width - margin;
    if (overflowsLeft && flippedFits) {
      placement = placement.replace("-end", "-start") as Placement;
    }
  }

  // Vertical. `bottom*` sits below the trigger, `top*` above. Flip toward
  // whichever side has more room when the panel doesn't fit on the current one.
  const spaceBelow = viewport.height - trigger.bottom - margin;
  const spaceAbove = trigger.top - margin;
  if (placement.startsWith("bottom") && panel.height > spaceBelow && spaceAbove > spaceBelow) {
    placement = placement.replace("bottom", "top") as Placement;
  } else if (placement.startsWith("top") && panel.height > spaceAbove && spaceBelow > spaceAbove) {
    placement = placement.replace("top", "bottom") as Placement;
  }

  return placement;
}
