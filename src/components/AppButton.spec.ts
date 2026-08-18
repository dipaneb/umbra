import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import AppButton from "./AppButton.vue";

describe("AppButton", () => {
  it("renders slot content inside a real <button>", () => {
    const wrapper = mount(AppButton, { slots: { default: "Install & Restart" } });

    const button = wrapper.find("button");
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe("Install & Restart");
  });

  it("defaults to the default variant when none is given", () => {
    const wrapper = mount(AppButton);

    expect(wrapper.find("button").classes()).toContain("default");
  });

  it("applies the primary variant class", () => {
    const wrapper = mount(AppButton, { props: { variant: "primary" } });

    expect(wrapper.find("button").classes()).toContain("primary");
  });

  it("applies the destructive variant class", () => {
    const wrapper = mount(AppButton, { props: { variant: "destructive" } });

    expect(wrapper.find("button").classes()).toContain("destructive");
  });

  it("defaults to type=button so it never accidentally submits a form", () => {
    const wrapper = mount(AppButton);

    expect(wrapper.find("button").attributes("type")).toBe("button");
  });

  it("forwards the disabled prop", () => {
    const wrapper = mount(AppButton, { props: { disabled: true } });

    expect(wrapper.find("button").attributes("disabled")).toBeDefined();
  });

  it("forwards click events", async () => {
    const wrapper = mount(AppButton);
    let clicked = false;
    wrapper.vm.$el.addEventListener("click", () => {
      clicked = true;
    });

    await wrapper.find("button").trigger("click");

    expect(clicked).toBe(true);
  });
});
