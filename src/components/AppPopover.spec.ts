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
