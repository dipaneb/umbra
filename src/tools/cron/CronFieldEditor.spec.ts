import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import CronFieldEditor, { type CronFieldKey } from "./CronFieldEditor.vue";

function mountField(fieldKey: CronFieldKey, modelValue: string, phrase = "") {
  return mount(CronFieldEditor, { props: { fieldKey, modelValue, phrase } });
}

describe("CronFieldEditor", () => {
  it("renders one text input seeded with the raw field value, plus the field label", () => {
    const wrapper = mountField("minute", "*/15");
    const input = wrapper.find("input");
    expect(input.attributes("type")).toBe("text");
    expect((input.element as HTMLInputElement).value).toBe("*/15");
    expect(wrapper.find(".field-label").text()).toBe("Minute");
  });

  it("shows the raw grammar verbatim, whatever shape it is", () => {
    for (const value of ["*", "5", "1,3,5", "1-5", "*/15", "10-50/5"]) {
      const wrapper = mountField("dayOfWeek", value);
      expect((wrapper.find("input").element as HTMLInputElement).value).toBe(value);
    }
  });

  it("emits update:modelValue with the raw typed value on input", async () => {
    const wrapper = mountField("minute", "5");
    await wrapper.find("input").setValue("1,3,5");
    expect(wrapper.emitted("update:modelValue")).toEqual([["1,3,5"]]);
  });

  it.each([
    ["minute", "Minute", "0-59"],
    ["hour", "Hour", "0-23"],
    ["dayOfMonth", "Day of month", "1-31"],
    ["month", "Month", "1-12"],
    ["dayOfWeek", "Day of week", "0-7"],
  ] as [CronFieldKey, string, string][])(
    "labels %s and carries its range hint in the accessible name",
    (fieldKey, name, range) => {
      const wrapper = mountField(fieldKey, "*");
      expect(wrapper.find(".field-label").text()).toBe(name);
      expect(wrapper.find("input").attributes("aria-label")).toBe(`${name} (${range})`);
    },
  );

  it("surfaces the per-field breakdown phrase as the input's hover title (AC12)", () => {
    const withPhrase = mountField("dayOfWeek", "1", "Monday");
    expect(withPhrase.find("input").attributes("title")).toBe("Day of week — Monday");

    const withoutPhrase = mountField("dayOfWeek", "1", "");
    expect(withoutPhrase.find("input").attributes("title")).toBe("Day of week (0-7)");
  });

  it("emits the typed value and never an advance event", async () => {
    const wrapper = mountField("minute", "0");
    await wrapper.find("input").setValue("*");
    expect(wrapper.emitted("update:modelValue")).toEqual([["*"]]);
    // The `*` auto-advance was removed at code review 2026-09-06: `*` is both a complete
    // field value and the first character of `*/15`, so advancing on the transition made
    // every step expression impossible to type. Traversal is plain Tab now.
    expect(wrapper.emitted("advance")).toBeUndefined();
  });

  it("lets a step expression be typed one character at a time", async () => {
    const wrapper = mountField("minute", "0");
    const input = wrapper.find("input");
    await input.setValue("*");
    await input.setValue("*/");
    await input.setValue("*/15");
    expect(wrapper.emitted("update:modelValue")).toEqual([["*"], ["*/"], ["*/15"]]);
    expect(wrapper.emitted("advance")).toBeUndefined();
  });

  it("exposes focus(), which focuses and selects the input", () => {
    const wrapper = mount(CronFieldEditor, {
      props: { fieldKey: "hour", modelValue: "9", phrase: "" },
      attachTo: document.body,
    });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    const input = wrapper.find("input").element as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(1);
    wrapper.unmount();
  });
});
