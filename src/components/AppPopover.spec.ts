import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent } from "vue";
import AppPopover from "./AppPopover.vue";

// A harness so the #trigger scoped slot (toggle + triggerProps) is exercised
// exactly as a real consumer wires it.
const Harness = defineComponent({
  components: { AppPopover },
  template: `
    <AppPopover label="Version help" placement="bottom-start">
      <template #trigger="{ toggle, triggerProps }">
        <button v-bind="triggerProps" class="trigger" @click="toggle">?</button>
      </template>
      <p class="pop-body">explainer</p>
    </AppPopover>
  `,
});

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

function mountHarness() {
  wrapper = mount(Harness, { attachTo: document.body });
  return wrapper;
}

const panel = (w: VueWrapper) => w.find('[role="dialog"]');
const trigger = (w: VueWrapper) => w.find("button.trigger");

describe("AppPopover", () => {
  it("renders the trigger and keeps the panel closed until asked", () => {
    mountHarness();

    expect(trigger(wrapper!).exists()).toBe(true);
    expect(trigger(wrapper!).attributes("aria-haspopup")).toBe("dialog");
    expect(trigger(wrapper!).attributes("aria-expanded")).toBe("false");
    expect(panel(wrapper!).exists()).toBe(false);
  });

  it("opens on trigger activation and wires ARIA to the panel", async () => {
    mountHarness();

    await trigger(wrapper!).trigger("click");
    await flushPromises();

    const p = panel(wrapper!);
    expect(p.exists()).toBe(true);
    expect(p.attributes("aria-label")).toBe("Version help");
    expect(p.text()).toContain("explainer");
    expect(trigger(wrapper!).attributes("aria-expanded")).toBe("true");
    expect(trigger(wrapper!).attributes("aria-controls")).toBe(p.attributes("id"));
  });

  it("toggles closed when the trigger is activated again", async () => {
    mountHarness();

    await trigger(wrapper!).trigger("click");
    await flushPromises();
    expect(panel(wrapper!).exists()).toBe(true);

    await trigger(wrapper!).trigger("click");
    await flushPromises();
    expect(panel(wrapper!).exists()).toBe(false);
  });

  it("does not flash back open when pressed while open and focusout fires with no relatedTarget (WebKit)", async () => {
    mountHarness();

    await trigger(wrapper!).trigger("click");
    await flushPromises();
    expect(panel(wrapper!).exists()).toBe(true);

    // WebKit/Tauri path: pressing the trigger moves focus off the panel, whose
    // focusout reports a null relatedTarget and closes the popover; the
    // trailing click must then NOT reopen it.
    await trigger(wrapper!).trigger("pointerdown");
    await panel(wrapper!).trigger("focusout"); // relatedTarget is null in jsdom
    await flushPromises();
    await trigger(wrapper!).trigger("click");
    await flushPromises();

    expect(panel(wrapper!).exists()).toBe(false);
  });

  it("closes on Escape from within the panel and returns focus to the trigger", async () => {
    mountHarness();

    await trigger(wrapper!).trigger("click");
    await flushPromises();

    // Escape is handled by a listener on the panel (which holds focus while
    // open), not a document listener — so it never swallows Escape app-wide.
    await panel(wrapper!).trigger("keydown", { key: "Escape" });
    await flushPromises();

    expect(panel(wrapper!).exists()).toBe(false);
    expect(document.activeElement).toBe(trigger(wrapper!).element);
  });

  it("does not consume Escape at the document level while open", async () => {
    mountHarness();
    await trigger(wrapper!).trigger("click");
    await flushPromises();

    let sawEscape = false;
    const spy = () => {
      sawEscape = true;
    };
    document.addEventListener("keydown", spy);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.removeEventListener("keydown", spy);

    expect(sawEscape).toBe(true);
    expect(panel(wrapper!).exists()).toBe(true);
  });

  it("closes on an outside pointer press without stealing focus back", async () => {
    mountHarness();

    await trigger(wrapper!).trigger("click");
    await flushPromises();

    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await flushPromises();

    expect(panel(wrapper!).exists()).toBe(false);
  });

  it("flips the applied data-placement when the preferred side would clip the viewport", async () => {
    // Preferred is bottom-start (the harness). Put the trigger hard against a
    // 400px-wide viewport's right edge and give the panel a 320px width so a
    // start-aligned panel overflows right but fits when end-aligned.
    const realGBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this instanceof HTMLElement && this.getAttribute("role") === "dialog") {
        return { left: 0, right: 320, top: 40, bottom: 140, width: 320, height: 100, x: 0, y: 40, toJSON: () => ({}) } as DOMRect;
      }
      if (this instanceof HTMLElement && this.classList.contains("popover-trigger")) {
        return { left: 380, right: 396, top: 20, bottom: 36, width: 16, height: 16, x: 380, y: 20, toJSON: () => ({}) } as DOMRect;
      }
      return realGBCR.call(this);
    };
    // Own properties on the element shadow jsdom's Element.prototype getters
    // (which always return 0); deleting them afterwards restores the default.
    Object.defineProperty(document.documentElement, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(document.documentElement, "clientHeight", { value: 800, configurable: true });

    try {
      mountHarness();
      await trigger(wrapper!).trigger("click");
      await flushPromises();
      expect(panel(wrapper!).attributes("data-placement")).toBe("bottom-end");
    } finally {
      Element.prototype.getBoundingClientRect = realGBCR;
      delete (document.documentElement as unknown as Record<string, unknown>).clientWidth;
      delete (document.documentElement as unknown as Record<string, unknown>).clientHeight;
    }
  });

  it("re-flips the open popover when a window resize makes the preferred side clip", async () => {
    const realGBCR = Element.prototype.getBoundingClientRect;
    const realRaf = window.requestAnimationFrame;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this instanceof HTMLElement && this.getAttribute("role") === "dialog") {
        return { left: 0, right: 320, top: 40, bottom: 140, width: 320, height: 100, x: 0, y: 40, toJSON: () => ({}) } as DOMRect;
      }
      if (this instanceof HTMLElement && this.classList.contains("popover-trigger")) {
        return { left: 380, right: 396, top: 20, bottom: 36, width: 16, height: 16, x: 380, y: 20, toJSON: () => ({}) } as DOMRect;
      }
      return realGBCR.call(this);
    };
    // Run the coalescing rAF callback synchronously.
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof window.requestAnimationFrame;
    // Wide enough that bottom-start fits on open.
    Object.defineProperty(document.documentElement, "clientWidth", { value: 1200, configurable: true });
    Object.defineProperty(document.documentElement, "clientHeight", { value: 800, configurable: true });

    try {
      mountHarness();
      await trigger(wrapper!).trigger("click");
      await flushPromises();
      expect(panel(wrapper!).attributes("data-placement")).toBe("bottom-start");

      // Shrink the window so a start-aligned 320px panel now overflows the right edge.
      Object.defineProperty(document.documentElement, "clientWidth", { value: 400, configurable: true });
      window.dispatchEvent(new Event("resize"));
      await flushPromises();

      expect(panel(wrapper!).attributes("data-placement")).toBe("bottom-end");
    } finally {
      Element.prototype.getBoundingClientRect = realGBCR;
      window.requestAnimationFrame = realRaf;
      delete (document.documentElement as unknown as Record<string, unknown>).clientWidth;
      delete (document.documentElement as unknown as Record<string, unknown>).clientHeight;
    }
  });

  it("stops re-flipping after the popover closes (resize listener removed)", async () => {
    mountHarness();
    await trigger(wrapper!).trigger("click");
    await flushPromises();
    await trigger(wrapper!).trigger("click");
    await flushPromises();

    // No throw and no work now that the popover is closed and its listener gone.
    expect(() => window.dispatchEvent(new Event("resize"))).not.toThrow();
    expect(panel(wrapper!).exists()).toBe(false);
  });

  it("keeps the preferred data-placement when nothing clips (jsdom zero rects)", async () => {
    mountHarness();
    await trigger(wrapper!).trigger("click");
    await flushPromises();
    expect(panel(wrapper!).attributes("data-placement")).toBe("bottom-start");
  });

  it("tears down the outside-pointerdown listener on unmount", async () => {
    mountHarness();
    await trigger(wrapper!).trigger("click");
    await flushPromises();

    wrapper!.unmount();
    wrapper = undefined;

    // No throw from a late outside press now that the listener is gone.
    expect(() =>
      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })),
    ).not.toThrow();
  });
});
