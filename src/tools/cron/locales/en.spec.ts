import { describe, expect, it } from "vitest";
import { englishCronLocale } from "./en";
import type { FieldTerm, ScheduleDescription } from "../scheduleDescription";

// --- Term builders, so the corpus below reads like cron rather than like JSON ------------

const every: FieldTerm = { kind: "every" };
const value = (v: number): FieldTerm => ({ kind: "value", value: v });
const values = (...v: number[]): FieldTerm => ({ kind: "values", values: v });
const range = (from: number, to: number): FieldTerm => ({ kind: "range", range: { from, to } });
const step = (s: number, within?: [number, number], from?: number): FieldTerm => ({
  kind: "step",
  step: s,
  within: within ? { from: within[0], to: within[1] } : null,
  from: from ?? null,
});
const union = (...parts: FieldTerm[]): FieldTerm => ({ kind: "union", parts });
const unsupported = (raw: string): FieldTerm => ({ kind: "unsupported", raw });

function schedule(
  minute: FieldTerm,
  hour: FieldTerm,
  dom: FieldTerm,
  month: FieldTerm,
  dow: FieldTerm,
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

const say = (s: ScheduleDescription) => englishCronLocale.sentence(s);

// Code review 2026-09-06: an hour union reached `valueName` and printed bare numbers
// ("during the 9 through 12 and 15 hours") while every other hour path used `hourName`.
describe("englishCronLocale union rendering", () => {
  it("names hours in an hour union instead of printing raw numbers", () => {
    const said = say(schedule(value(0), union(range(9, 12), value(15)), every, every, every));
    expect(said).not.toMatch(/\b15 hours\b/);
    expect(said).toContain("3 PM");
  });

  it("renders a month union", () => {
    expect(say(schedule(value(0), value(0), every, union(range(1, 3), value(6)), every))).toContain(
      "January through March and June",
    );
  });

  it("renders a day-of-month union", () => {
    expect(say(schedule(value(0), value(0), union(range(1, 5), value(10)), every, every))).toContain(
      "the 1st through 5th and 10th",
    );
  });

  it("renders a weekday union", () => {
    expect(say(schedule(value(0), value(0), every, every, union(range(1, 5), value(0))))).toContain(
      "Monday through Friday and Sunday",
    );
  });
});

describe("englishCronLocale.sentence", () => {
  // The same corpus the Rust templater was held to before the renderer moved to the view —
  // ported verbatim so the migration is provably behaviour-preserving. Each row is a real
  // expression from crontab.guru's popular list or a published cheat sheet.
  const CORPUS: [string, ScheduleDescription, string][] = [
    // every-N-minutes
    ["* * * * *", schedule(every, every, every, every, every), "Every day, every minute"],
    ["*/1 * * * *", schedule(step(1), every, every, every, every), "Every day, every minute"],
    ["*/5 * * * *", schedule(step(5), every, every, every, every), "Every day, every 5 minutes"],
    ["*/15 * * * *", schedule(step(15), every, every, every, every), "Every day, every 15 minutes"],
    [
      "1-59/2 * * * *",
      schedule(step(2, [1, 59]), every, every, every, every),
      "Every day, every 2 minutes from minute 1 through 59",
    ],
    [
      "5/10 * * * *",
      schedule(step(10, undefined, 5), every, every, every, every),
      "Every day, every 10 minutes from minute 5",
    ],
    // hourly variants
    ["0 * * * *", schedule(value(0), every, every, every, every), "Every day, every hour"],
    [
      "30 * * * *",
      schedule(value(30), every, every, every, every),
      "Every day, at minute 30 of every hour",
    ],
    [
      "0,30 * * * *",
      schedule(values(0, 30), every, every, every, every),
      "Every day, at minutes 0 and 30 of every hour",
    ],
    [
      "15,45 * * * *",
      schedule(values(15, 45), every, every, every, every),
      "Every day, at minutes 15 and 45 of every hour",
    ],
    ["0 */2 * * *", schedule(value(0), step(2), every, every, every), "Every day, every 2 hours"],
    [
      "15 */2 * * *",
      schedule(value(15), step(2), every, every, every),
      "Every day, every 2 hours at 15 minutes past the hour",
    ],
    // daily at a time
    ["0 0 * * *", schedule(value(0), value(0), every, every, every), "Every day, at 12:00 AM"],
    ["0 9 * * *", schedule(value(0), value(9), every, every, every), "Every day, at 9:00 AM"],
    ["30 2 * * *", schedule(value(30), value(2), every, every, every), "Every day, at 2:30 AM"],
    ["45 23 * * *", schedule(value(45), value(23), every, every, every), "Every day, at 11:45 PM"],
    ["9 9 * * *", schedule(value(9), value(9), every, every, every), "Every day, at 9:09 AM"],
    [
      "0 9,12,17 * * *",
      schedule(value(0), values(9, 12, 17), every, every, every),
      "Every day, at 9:00 AM, 12:00 PM, and 5:00 PM",
    ],
    [
      "0 9,21 * * *",
      schedule(value(0), values(9, 21), every, every, every),
      "Every day, at 9:00 AM and 9:00 PM",
    ],
    [
      "0 9-17 * * *",
      schedule(value(0), range(9, 17), every, every, every),
      "Every day, on the hour between 9:00 AM and 5:59 PM",
    ],
    [
      "* 9 * * *",
      schedule(every, value(9), every, every, every),
      "Every day, every minute during the 9 AM hour",
    ],
    [
      "* 9-17 * * *",
      schedule(every, range(9, 17), every, every, every),
      "Every day, every minute between 9:00 AM and 5:59 PM",
    ],
    // weekly
    ["0 9 * * 1", schedule(value(0), value(9), every, every, value(1)), "Every Monday, at 9:00 AM"],
    ["0 17 * * 5", schedule(value(0), value(17), every, every, value(5)), "Every Friday, at 5:00 PM"],
    ["0 0 * * 0", schedule(value(0), value(0), every, every, value(0)), "Every Sunday, at 12:00 AM"],
    ["0 0 * * 7", schedule(value(0), value(0), every, every, value(7)), "Every Sunday, at 12:00 AM"],
    [
      "0 9 * * 1-5",
      schedule(value(0), value(9), every, every, range(1, 5)),
      "Every weekday, at 9:00 AM",
    ],
    [
      "0 9 * * 0,6",
      schedule(value(0), value(9), every, every, values(0, 6)),
      "Every Sunday and Saturday, at 9:00 AM",
    ],
    [
      "0 6 * * 1,3,5",
      schedule(value(0), value(6), every, every, values(1, 3, 5)),
      "Every Monday, Wednesday, and Friday, at 6:00 AM",
    ],
    [
      "*/30 9-17 * * 1-5",
      schedule(step(30), range(9, 17), every, every, range(1, 5)),
      "Every weekday, every 30 minutes between 9:00 AM and 5:59 PM",
    ],
    [
      "0 0 * * 1-5,0",
      schedule(value(0), value(0), every, every, union(range(1, 5), value(0))),
      "Every Monday through Friday and Sunday, at 12:00 AM",
    ],
    // months
    [
      "0 0 * JAN *",
      schedule(value(0), value(0), every, value(1), every),
      "Every day in January, at 12:00 AM",
    ],
    [
      "0 0 * jan-mar *",
      schedule(value(0), value(0), every, range(1, 3), every),
      "Every day from January through March, at 12:00 AM",
    ],
    [
      "0 0 1 JAN,APR,JUL,OCT *",
      schedule(value(0), value(0), value(1), values(1, 4, 7, 10), every),
      "On the 1st in January, April, July, and October, at 12:00 AM",
    ],
    // monthly / yearly
    ["0 0 1 * *", schedule(value(0), value(0), value(1), every, every), "On the 1st, at 12:00 AM"],
    [
      "0 0 1,15 * *",
      schedule(value(0), value(0), values(1, 15), every, every),
      "On the 1st and 15th, at 12:00 AM",
    ],
    [
      "0 0 28-31 * *",
      schedule(value(0), value(0), range(28, 31), every, every),
      "On the 28th through the 31st, at 12:00 AM",
    ],
    [
      "0 0 1 */3 *",
      schedule(value(0), value(0), value(1), step(3), every),
      "On the 1st, every 3 months, at 12:00 AM",
    ],
    [
      "0 0 1 1 *",
      schedule(value(0), value(0), value(1), value(1), every),
      "On January 1st, at 12:00 AM",
    ],
    [
      "0 0 25 12 *",
      schedule(value(0), value(0), value(25), value(12), every),
      "On December 25th, at 12:00 AM",
    ],
    [
      "0 0 */3 * *",
      schedule(value(0), value(0), step(3), every, every),
      "On every 3rd day-of-month, at 12:00 AM",
    ],
    // cron's day-field OR quirk
    [
      "0 9 1-7 * 1",
      schedule(value(0), value(9), range(1, 7), every, value(1)),
      "On the 1st through the 7th or every Monday, at 9:00 AM",
    ],
    [
      "*/15 9-17 9 * 1-5",
      schedule(step(15), range(9, 17), value(9), every, range(1, 5)),
      "On the 9th or every weekday, every 15 minutes between 9:00 AM and 5:59 PM",
    ],
    // mixed list
    [
      "1-5,10 * * * *",
      schedule(union(range(1, 5), value(10)), every, every, every, every),
      "Every day, at minutes 1 through 5 and 10 of every hour",
    ],
  ];

  it.each(CORPUS)("renders %s", (_expression, input, expected) => {
    expect(say(input)).toBe(expected);
  });

  it("never produces an empty or untouched sentence across the corpus", () => {
    for (const [expression, input] of CORPUS) {
      const sentence = say(input);
      expect(sentence.length, `${expression} produced nothing`).toBeGreaterThan(5);
      expect(sentence[0]).toBe(sentence[0].toUpperCase());
    }
  });

  it("uses CLDR ordinal categories rather than a hardcoded suffix table", () => {
    // 1st / 2nd / 3rd / 4th / 11th / 21st / 22nd / 23rd — the cases a naive `n + "th"` or a
    // `% 10` table gets wrong.
    const dayOf = (n: number) =>
      say(schedule(value(0), value(0), value(n), { kind: "every" }, { kind: "every" }));
    expect(dayOf(1)).toContain("the 1st");
    expect(dayOf(2)).toContain("the 2nd");
    expect(dayOf(3)).toContain("the 3rd");
    expect(dayOf(4)).toContain("the 4th");
    expect(dayOf(11)).toContain("the 11th");
    expect(dayOf(12)).toContain("the 12th");
    expect(dayOf(13)).toContain("the 13th");
    expect(dayOf(21)).toContain("the 21st");
    expect(dayOf(22)).toContain("the 22nd");
    expect(dayOf(23)).toContain("the 23rd");
  });

  it("renders an unsupported field verbatim instead of guessing", () => {
    const s = schedule(value(0), value(0), unsupported("L"), every, every);
    expect(say(s)).toContain("as specified (L)");
  });
});

describe("englishCronLocale.fieldPhrase", () => {
  it("names every shape in every field", () => {
    expect(englishCronLocale.fieldPhrase("minute", every)).toBe("every minute");
    expect(englishCronLocale.fieldPhrase("hour", every)).toBe("every hour");
    expect(englishCronLocale.fieldPhrase("dayOfMonth", every)).toBe("every day");
    expect(englishCronLocale.fieldPhrase("month", every)).toBe("every month");
    expect(englishCronLocale.fieldPhrase("dayOfWeek", every)).toBe("every day of the week");

    expect(englishCronLocale.fieldPhrase("minute", value(5))).toBe("5");
    expect(englishCronLocale.fieldPhrase("hour", value(9))).toBe("9");
    expect(englishCronLocale.fieldPhrase("dayOfMonth", value(15))).toBe("the 15th");
    expect(englishCronLocale.fieldPhrase("month", value(6))).toBe("June");
    expect(englishCronLocale.fieldPhrase("dayOfWeek", value(1))).toBe("Monday");

    expect(englishCronLocale.fieldPhrase("minute", values(0, 15, 30))).toBe(
      "0, 15, and 30",
    );
    expect(englishCronLocale.fieldPhrase("dayOfWeek", values(1, 3, 5))).toBe(
      "Monday, Wednesday, and Friday",
    );

    expect(englishCronLocale.fieldPhrase("minute", range(0, 29))).toBe("minutes 0 through 29");
    expect(englishCronLocale.fieldPhrase("dayOfMonth", range(1, 15))).toBe(
      "the 1st through the 15th",
    );
    expect(englishCronLocale.fieldPhrase("month", range(3, 8))).toBe("March through August");
    expect(englishCronLocale.fieldPhrase("dayOfWeek", range(1, 5))).toBe("Monday through Friday");

    expect(englishCronLocale.fieldPhrase("minute", step(15))).toBe("every 15 minutes");
    expect(englishCronLocale.fieldPhrase("dayOfWeek", step(2))).toBe("on every 2nd day-of-week");
    expect(englishCronLocale.fieldPhrase("minute", step(5, [10, 50]))).toBe(
      "every 5 minutes from minute 10 through 50",
    );
    expect(englishCronLocale.fieldPhrase("dayOfMonth", step(7, [1, 28]))).toBe(
      "on every 7th day-of-month from the 1st through the 28th",
    );

    expect(englishCronLocale.fieldPhrase("minute", union(range(1, 5), value(10)))).toBe(
      "minutes 1 through 5 and 10",
    );
    expect(englishCronLocale.fieldPhrase("dayOfMonth", unsupported("L"))).toBe(
      "as specified (L)",
    );
  });

  it("treats both 0 and 7 as Sunday", () => {
    expect(englishCronLocale.fieldPhrase("dayOfWeek", value(0))).toBe("Sunday");
    expect(englishCronLocale.fieldPhrase("dayOfWeek", value(7))).toBe("Sunday");
  });
});
