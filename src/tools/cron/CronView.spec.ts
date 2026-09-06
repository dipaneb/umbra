import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, type Pinia } from "pinia";
import CronFieldEditor from "./CronFieldEditor.vue";
import CronView from "./CronView.vue";
import type { FieldTerm, ScheduleDescription } from "./scheduleDescription";

const { invokeMock, writeTextMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  writeTextMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  writeText: (text: string) => writeTextMock(text),
}));

// Explain is live and debounced (src/shell/debounce.ts, 200ms). Fake timers mean a pending
// debounce never fires unless a test advances the clock. Same pattern as JwtView.spec.ts.
const DEBOUNCE_MS = 200;
const SEED = "0 9 * * *";

// Core returns the schedule's *meaning*; the English sentence in these assertions is what
// src/tools/cron/locales/en.ts renders from it (vitest.setup.ts pins the locale to English).
const every: FieldTerm = { kind: "every" };
const value = (v: number): FieldTerm => ({ kind: "value", value: v });
const range = (from: number, to: number): FieldTerm => ({ kind: "range", range: { from, to } });
const step = (s: number): FieldTerm => ({ kind: "step", step: s, within: null, from: null });

function schedule(
  minute: FieldTerm,
  hour: FieldTerm,
  dom: FieldTerm = every,
  month: FieldTerm = every,
  dow: FieldTerm = every,
): ScheduleDescription {
  const domRestricted = dom.kind !== "every";
  const dowRestricted = dow.kind !== "every";
  return {
    minute,
    hour,
    day_of_month: dom,
    month,
    day_of_week: dow,
    day_match: domRestricted
      ? dowRestricted
        ? "either_day_field"
        : "day_of_month_only"
      : dowRestricted
        ? "day_of_week_only"
        : "every_day",
  };
}

const explanation = (s: ScheduleDescription, next_runs = [1_757_060_400]) => ({
  schedule: s,
  next_runs,
});

// `0 9 * * *` -> "Every day, at 9:00 AM"
const SEED_EXPLANATION = explanation(schedule(value(0), value(9)), [
  1_757_060_400, 1_757_146_800, 1_757_233_200,
]);

let wrapper: VueWrapper | undefined;
let pinia: Pinia;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  invokeMock.mockReset();
  writeTextMock.mockReset();
  vi.useRealTimers();
});

// The seed explain fires from onMounted (immediately, not debounced).
async function mountView(seedExplanation: unknown = SEED_EXPLANATION, attachTo?: HTMLElement) {
  invokeMock.mockResolvedValueOnce(seedExplanation);
  pinia = createPinia();
  wrapper = mount(CronView, { global: { plugins: [pinia] }, attachTo });
  await flushPromises();
  return wrapper;
}

function fieldEditors(w: VueWrapper) {
  return w.findAllComponents(CronFieldEditor);
}

function readout(w: VueWrapper): string {
  return w.find(".expr-code").text();
}

type Outcome = { resolve: unknown } | { reject: unknown };

function queue(outcome?: Outcome) {
  if (outcome && "resolve" in outcome) invokeMock.mockResolvedValueOnce(outcome.resolve);
  if (outcome && "reject" in outcome) invokeMock.mockRejectedValueOnce(outcome.reject);
}

// A field-box edit — a keystroke, so debounced.
async function editField(w: VueWrapper, index: number, value: string, outcome?: Outcome) {
  queue(outcome);
  fieldEditors(w)[index].vm.$emit("update:modelValue", value);
  await flushPromises();
  vi.advanceTimersByTime(DEBOUNCE_MS);
  await flushPromises();
}

// A whole cron expression pasted onto the field strip — distributes and re-explains at once.
async function pasteExpression(w: VueWrapper, text: string, outcome?: Outcome) {
  queue(outcome);
  await w.find(".grid").trigger("paste", { clipboardData: { getData: () => text } });
  await flushPromises();
}

describe("CronView", () => {
  it("mounts seeded on 0 9 * * *, showing the read-only expression and the prose + 3 runs (AC6)", async () => {
    await mountView();

    expect(invokeMock).toHaveBeenCalledWith("cron_explain", { expression: SEED });
    expect(readout(wrapper!)).toBe(SEED);
    expect(wrapper!.text()).toContain("Every day, at 9:00 AM");
    for (const epochSeconds of SEED_EXPLANATION.next_runs) {
      expect(wrapper!.text()).toContain(new Date(epochSeconds * 1000).toLocaleString());
    }
  });

  it("has no whole-expression <input>, no action buttons, no phrase textarea, no english-only notice (AC6, AC9)", async () => {
    await mountView();

    // The five field boxes are the only text inputs — no separate whole-string input.
    expect(wrapper!.findAll('input[type="text"]')).toHaveLength(5);
    expect(wrapper!.find("#cron-expression-input").exists()).toBe(false);
    expect(wrapper!.find("code.expr-code").exists()).toBe(true);

    const buttonLabels = wrapper!.findAll("button").map((b) => b.text());
    expect(buttonLabels).not.toContain("Explain");
    expect(buttonLabels).not.toContain("Convert");
    expect(buttonLabels).not.toContain("Paste from clipboard");
    expect(wrapper!.find("#cron-schedule-phrase-input").exists()).toBe(false);
    expect(wrapper!.find(".english-only-notice").exists()).toBe(false);
  });

  it("renders the 5-field strip seeded from 0 9 * * *, each box holding its raw value + phrase (AC6, AC12)", async () => {
    await mountView();
    const editors = fieldEditors(wrapper!);
    expect(editors).toHaveLength(5);
    expect(editors.map((e) => e.props("modelValue"))).toEqual(["0", "9", "*", "*", "*"]);
    expect(editors.map((e) => e.props("phrase"))).toEqual([
      "0",
      "9",
      "every day",
      "every month",
      "every day of the week",
    ]);
  });

  it("never invokes cron_parse_schedule (AC9)", async () => {
    await mountView();
    await editField(wrapper!, 0, "*/15", { resolve: SEED_EXPLANATION });

    const invokedCommands = invokeMock.mock.calls.map((call) => call[0]);
    expect(new Set(invokedCommands)).toEqual(new Set(["cron_explain"]));
  });

  it("recomposes the expression and re-explains after the 200ms debounce on a field edit (AC8)", async () => {
    await mountView();

    await editField(wrapper!, 4, "1", {
      resolve: explanation(schedule(value(0), value(9), every, every, value(1))),
    });

    expect(readout(wrapper!)).toBe("0 9 * * 1");
    expect(invokeMock).toHaveBeenLastCalledWith("cron_explain", { expression: "0 9 * * 1" });
    expect(wrapper!.text()).toContain("Every Monday, at 9:00 AM");
  });

  it("does not recompute until the debounce elapses (AC8)", async () => {
    await mountView();
    invokeMock.mockClear();

    fieldEditors(wrapper!)[0].vm.$emit("update:modelValue", "30");
    await flushPromises();
    expect(invokeMock).not.toHaveBeenCalled();

    queue({ resolve: explanation(schedule(value(30), value(9))) });
    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("cron_explain", { expression: "30 9 * * *" });
  });

  it("renders an invalid field value as role=alert and clears the stale panel (AC23, AC25)", async () => {
    await mountView();
    expect(wrapper!.text()).toContain("Every day, at 9:00 AM");

    await editField(wrapper!, 0, "99", {
      reject: {
        code: "cron-component-error",
        message: "Number out of bounds.",
        position: null,
        context: "minute field: 99 is out of range (0-59)",
      },
    });

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("Number out of bounds.");
    expect(wrapper!.find(".panel").exists()).toBe(false);
  });

  it("carries role=status on a successful live panel (AC23)", async () => {
    await mountView();
    const status = wrapper!.find(".panel[role='status']");
    expect(status.exists()).toBe(true);
    expect(status.text()).toContain("Every day, at 9:00 AM");
  });

  it("announces a completed explain through the always-present polite region (AC24)", async () => {
    await mountView();
    // The region is in the DOM from first render — a live region inserted together with its
    // text is not reliably announced.
    const region = wrapper!.find(".sr-only[role='status']");
    expect(region.exists()).toBe(true);
    expect(region.attributes("aria-live")).toBe("polite");
    expect(region.text()).toBe("Expression explained.");
  });

  it("renders a calendrically impossible expression as role=alert (AC25)", async () => {
    await mountView();

    // `0 0 30 2 *` parses fine but can never match — core's cron-no-upcoming-runs guard.
    await editField(wrapper!, 2, "30", {
      reject: {
        code: "cron-no-upcoming-runs",
        message:
          "This expression has no upcoming occurrences — the date it specifies may never exist (e.g. February 30th).",
        position: null,
        context: null,
      },
    });

    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain("no upcoming occurrences");
    expect(wrapper!.find(".panel").exists()).toBe(false);
  });

  it("discards a stale result from a superseded explain call — one local runner (AC9, AC25)", async () => {
    await mountView();

    let resolveFirst: (value: unknown) => void = () => {};
    invokeMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fieldEditors(wrapper!)[0].vm.$emit("update:modelValue", "1");
    await flushPromises();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();

    // Two clearly distinguishable results: 2:02 AM (fresh) vs 1:01 AM (stale).
    invokeMock.mockResolvedValueOnce(explanation(schedule(value(2), value(2))));
    fieldEditors(wrapper!)[0].vm.$emit("update:modelValue", "2");
    await flushPromises();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();

    resolveFirst(explanation(schedule(value(1), value(1))));
    await flushPromises();

    expect(wrapper!.text()).toContain("2:02 AM");
    expect(wrapper!.text()).not.toContain("1:01 AM");
  });

  // Code review 2026-09-06. Distinct from the supersession test above: there, a *second
  // invoke* starts before the first resolves, which `runLatestWins` already fences. Here the
  // user simply types while one request is in flight — no new invoke, so neither
  // `explainGeneration` nor `latestRequestId` moves, and the write-back used to restore the
  // stale snapshot over the character just typed.
  it("does not let an in-flight result overwrite a field edited while it was pending", async () => {
    await mountView();

    let resolveFirst: (value: unknown) => void = () => {};
    invokeMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    fieldEditors(wrapper!)[1].vm.$emit("update:modelValue", "1");
    await flushPromises();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();

    // The request for "0 1 * * *" is in flight. The user keeps typing: the box is now "12".
    fieldEditors(wrapper!)[1].vm.$emit("update:modelValue", "12");
    await flushPromises();

    // The older request lands. It must not touch the boxes or the expression.
    resolveFirst(explanation(schedule(value(0), value(1))));
    await flushPromises();

    expect(wrapper!.find(".expr-code").text()).toBe("0 12 * * *");
    expect(fieldEditors(wrapper!)[1].props("modelValue")).toBe("12");
  });

  it("copies the composed expression string, confirming only after the write resolves; clears on edit (AC22)", async () => {
    await mountView();
    let resolveWrite: () => void = () => {};
    writeTextMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const copyButton = wrapper!.find(".expr-copy");
    await copyButton.trigger("click");
    expect(writeTextMock).toHaveBeenCalledWith(SEED);
    expect(copyButton.find(".expr-copy-ok").exists()).toBe(false);

    resolveWrite();
    await flushPromises();
    expect(wrapper!.find(".expr-copy .expr-copy-ok").exists()).toBe(true);

    await editField(wrapper!, 0, "5", { resolve: SEED_EXPLANATION });
    expect(wrapper!.find(".expr-copy .expr-copy-ok").exists()).toBe(false);
  });

  it("stops recomputing after unmount — debounce cancelled (AC8)", async () => {
    await mountView();
    fieldEditors(wrapper!)[0].vm.$emit("update:modelValue", "7");
    await flushPromises();
    wrapper!.unmount();
    wrapper = undefined;
    invokeMock.mockClear();

    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("shows a calm status line, never calls the backend, and clears the panel for an over-cap value (AC17)", async () => {
    await mountView();
    expect(wrapper!.text()).toContain("Every day, at 9:00 AM");
    invokeMock.mockClear();

    fieldEditors(wrapper!)[0].vm.$emit("update:modelValue", "0".repeat(1025));
    await flushPromises();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();

    const line = wrapper!.find(".oversize");
    expect(line.exists()).toBe(true);
    expect(line.attributes("role")).toBe("status");
    expect(wrapper!.find("[role='alert']").exists()).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(wrapper!.find(".panel").exists()).toBe(false);
  });

  it("clears the oversize status once the value is back under the cap", async () => {
    await mountView();
    fieldEditors(wrapper!)[0].vm.$emit("update:modelValue", "0".repeat(1025));
    await flushPromises();
    vi.advanceTimersByTime(DEBOUNCE_MS);
    await flushPromises();
    expect(wrapper!.find(".oversize").exists()).toBe(true);

    await editField(wrapper!, 0, "0", { resolve: SEED_EXPLANATION });
    expect(wrapper!.find(".oversize").exists()).toBe(false);
  });

  it("pasting a whole 5-field expression onto the strip distributes it across the boxes and re-explains (AC7)", async () => {
    await mountView();

    await pasteExpression(wrapper!, "*/15 9-17 * * 1-5", {
      resolve: explanation(schedule(step(15), range(9, 17), every, every, range(1, 5))),
    });

    expect(readout(wrapper!)).toBe("*/15 9-17 * * 1-5");
    expect(invokeMock).toHaveBeenLastCalledWith("cron_explain", {
      expression: "*/15 9-17 * * 1-5",
    });
    const editors = fieldEditors(wrapper!);
    expect(editors.map((e) => e.props("modelValue"))).toEqual(["*/15", "9-17", "*", "*", "1-5"]);
    expect(editors[4].props("phrase")).toBe("Monday through Friday");
  });

  it("renders the prose one-liner with a secondary copy button, and no breakdown beside it (AC12, AC15, AC22)", async () => {
    await mountView();

    expect(wrapper!.find(".panel-prose").text()).toBe("Every day, at 9:00 AM");
    // Prose XOR breakdown (render-review 2026-09-06). The breakdown was the floor under a
    // sentence that could degrade to a generic fallback; that fallback is gone, so showing
    // both restated the sentence — on the seed, three of five rows just said "every".
    expect(wrapper!.findAll(".breakdown li")).toHaveLength(0);
    // The phrases are still live on every box's hover title.
    expect(fieldEditors(wrapper!)[0].props("phrase")).toBe("0");

    let resolveWrite: () => void = () => {};
    writeTextMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveWrite = resolve)),
    );
    const proseCopy = wrapper!.find(".prose-copy");
    await proseCopy.trigger("click");
    expect(writeTextMock).toHaveBeenCalledWith("Every day, at 9:00 AM");
    expect(proseCopy.find(".prose-copy-ok").exists()).toBe(false);

    resolveWrite();
    await flushPromises();
    expect(wrapper!.find(".prose-copy .prose-copy-ok").exists()).toBe(true);
  });

  it("suppresses the prose one-liner when a field uses unsupported syntax, keeping the breakdown rows (AC14)", async () => {
    // What triggers suppression changed with the renderer move: it used to mean "describe()
    // gave up on this shape", which happened for ordinary expressions. Now the sentence
    // covers the whole plain grammar, so the only trigger left is genuinely unmodelled
    // syntax — `L`, `5#3`, `15W` (Story 8.6 Cut #3).
    await mountView(
      explanation(
        schedule(value(0), value(0), { kind: "unsupported", raw: "L" }, every, every),
      ),
    );

    expect(wrapper!.find(".panel-prose-row").exists()).toBe(false);
    const rows = wrapper!
      .findAll(".breakdown li")
      .map((li) => li.text().replace(/\s+/g, " ").trim());
    expect(rows[0]).toBe("Minute: 0");
    expect(rows[2]).toBe("Day of month: as specified (L)");
    // The panel itself still announces success, and the other four rows still read normally.
    expect(wrapper!.find(".panel[role='status']").exists()).toBe(true);
  });

  it("clears a 'copied' tick on the next field edit (AC22)", async () => {
    await mountView();
    let resolveWrite: () => void = () => {};
    writeTextMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveWrite = resolve)),
    );
    await wrapper!.find(".expr-copy").trigger("click");
    resolveWrite();
    await flushPromises();
    expect(wrapper!.find(".expr-copy .expr-copy-ok").exists()).toBe(true);

    fieldEditors(wrapper!)[0].vm.$emit("update:modelValue", "5");
    await flushPromises();
    expect(wrapper!.find(".expr-copy .expr-copy-ok").exists()).toBe(false);
  });

  // Code review 2026-09-06 replaced the `*` auto-advance with plain Tab traversal: `*` is
  // both a complete field value and the first character of `*/15`, so advancing on the
  // transition moved focus mid-token and the `/15` overwrote the next box.
  it("keeps focus in the edited box so a step expression can be typed", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await mountView(SEED_EXPLANATION, host);

    const editors = fieldEditors(wrapper!);
    const minuteInput = editors[0].find("input").element as HTMLInputElement;

    minuteInput.focus();
    await editors[0].find("input").setValue("*");
    await flushPromises();
    expect(document.activeElement).toBe(minuteInput);

    await editors[0].find("input").setValue("*/15");
    await flushPromises();
    expect(document.activeElement).toBe(minuteInput);
    expect(wrapper!.find(".expr-code").text()).toContain("*/15");

    host.remove();
  });

  it("keeps focus in the last field box when Day of week becomes `*`", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await mountView(SEED_EXPLANATION, host);

    const dowEditor = fieldEditors(wrapper!)[4];
    await dowEditor.find("input").setValue("1");
    await flushPromises();
    const dowInput = dowEditor.find("input").element as HTMLInputElement;
    dowInput.focus();
    await dowEditor.find("input").setValue("*");
    await flushPromises();

    expect(document.activeElement).toBe(dowInput);

    host.remove();
  });

  it("pasting a 6-field expression sends it through as-is for the honest six-field rejection (AC16)", async () => {
    await mountView();

    await pasteExpression(wrapper!, "30 0 9 * * 1", {
      reject: {
        code: "cron-six-field-unsupported",
        message: "raw backend message — should not be shown",
        position: null,
        context: null,
      },
    });

    expect(invokeMock).toHaveBeenLastCalledWith("cron_explain", { expression: "30 0 9 * * 1" });
    const alert = wrapper!.find("[role='alert']");
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toBe(
      "This tool handles standard 5-field cron expressions. Seconds-precision (6-field) expressions aren't supported yet.",
    );
    expect(wrapper!.find(".panel").exists()).toBe(false);
  });
});
