import { describe, expect, it } from "vitest";
import { frenchCronLocale } from "./fr";
import type { FieldTerm, ScheduleDescription } from "../scheduleDescription";

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

const say = (s: ScheduleDescription) => frenchCronLocale.sentence(s);

// Code review 2026-09-06: before this block the only `union(` case in this file was on the
// minute field — the one position where a part needs no article, so it could not reveal that
// `partPhrase` was bypassing `boundsPhrase` and dropping every `du…au` / `de…à` contraction.
// A union is covered in all five fields now.
describe("frenchCronLocale union rendering", () => {
  it("keeps the de…à contraction in a month union", () => {
    expect(say(schedule(value(0), value(0), every, union(range(1, 3), value(6)), every))).toBe(
      "Tous les jours de janvier à mars et en juin, à 0h00",
    );
  });

  it("keeps the du…au contraction and the article in a day-of-month union", () => {
    expect(say(schedule(value(0), value(0), union(range(1, 5), value(10)), every, every))).toBe(
      "Du 1er au 5 et le 10, à 0h00",
    );
  });

  it("keeps the du…au contraction in a weekday union", () => {
    expect(say(schedule(value(0), value(0), every, every, union(range(1, 5), value(0))))).toBe(
      "Du lundi au vendredi et tous les dimanches, à 0h00",
    );
  });

  it("names hours rather than bare numbers in an hour union", () => {
    const said = say(schedule(value(0), union(range(9, 12), value(15)), every, every, every));
    expect(said).not.toMatch(/\b12 et 15\b/);
    expect(said).toContain("15h");
  });

  it("renders a minute union", () => {
    expect(say(schedule(union(range(1, 5), value(10)), every, every, every, every))).toContain(
      "minute",
    );
  });
});

describe("frenchCronLocale.sentence", () => {
  // The same real-world expressions the English corpus covers, so the two locales stay in
  // lockstep on *which* schedules are supported even though the phrasing is independent.
  const CORPUS: [string, ScheduleDescription, string][] = [
    ["* * * * *", schedule(every, every, every, every, every), "Tous les jours, chaque minute"],
    [
      "*/15 * * * *",
      schedule(step(15), every, every, every, every),
      "Tous les jours, toutes les 15 minutes",
    ],
    [
      "*/1 * * * *",
      schedule(step(1), every, every, every, every),
      "Tous les jours, chaque minute",
    ],
    ["0 * * * *", schedule(value(0), every, every, every, every), "Tous les jours, toutes les heures"],
    [
      "30 * * * *",
      schedule(value(30), every, every, every, every),
      "Tous les jours, à la minute 30 de chaque heure",
    ],
    [
      "0,30 * * * *",
      schedule(values(0, 30), every, every, every, every),
      "Tous les jours, aux minutes 0 et 30 de chaque heure",
    ],
    ["0 0 * * *", schedule(value(0), value(0), every, every, every), "Tous les jours, à 0h00"],
    ["0 9 * * *", schedule(value(0), value(9), every, every, every), "Tous les jours, à 9h00"],
    ["30 2 * * *", schedule(value(30), value(2), every, every, every), "Tous les jours, à 2h30"],
    ["45 23 * * *", schedule(value(45), value(23), every, every, every), "Tous les jours, à 23h45"],
    [
      "0 9,12,17 * * *",
      schedule(value(0), values(9, 12, 17), every, every, every),
      "Tous les jours, à 9h00, 12h00 et 17h00",
    ],
    [
      "0 9-17 * * *",
      schedule(value(0), range(9, 17), every, every, every),
      "Tous les jours, à l'heure pile entre 9h00 et 17h59",
    ],
    [
      "* 9 * * *",
      schedule(every, value(9), every, every, every),
      "Tous les jours, chaque minute entre 9h00 et 9h59",
    ],
    ["0 */2 * * *", schedule(value(0), step(2), every, every, every), "Tous les jours, toutes les 2 heures"],
    [
      "15 */2 * * *",
      schedule(value(15), step(2), every, every, every),
      "Tous les jours, toutes les 2 heures à la minute 15",
    ],
    // weekdays pluralise: "tous les lundis"
    ["0 9 * * 1", schedule(value(0), value(9), every, every, value(1)), "Tous les lundis, à 9h00"],
    ["0 0 * * 0", schedule(value(0), value(0), every, every, value(0)), "Tous les dimanches, à 0h00"],
    ["0 0 * * 7", schedule(value(0), value(0), every, every, value(7)), "Tous les dimanches, à 0h00"],
    [
      "0 9 * * 1-5",
      schedule(value(0), value(9), every, every, range(1, 5)),
      "Du lundi au vendredi, à 9h00",
    ],
    [
      "0 6 * * 1,3,5",
      schedule(value(0), value(6), every, every, values(1, 3, 5)),
      "Tous les lundis, mercredis et vendredis, à 6h00",
    ],
    [
      "*/30 9-17 * * 1-5",
      schedule(step(30), range(9, 17), every, every, range(1, 5)),
      "Du lundi au vendredi, toutes les 30 minutes entre 9h00 et 17h59",
    ],
    // months
    [
      "0 0 * JAN *",
      schedule(value(0), value(0), every, value(1), every),
      "Tous les jours en janvier, à 0h00",
    ],
    [
      "0 0 * jan-mar *",
      schedule(value(0), value(0), every, range(1, 3), every),
      "Tous les jours de janvier à mars, à 0h00",
    ],
    // day of month
    ["0 0 1 * *", schedule(value(0), value(0), value(1), every, every), "Le 1er, à 0h00"],
    ["0 0 15 * *", schedule(value(0), value(0), value(15), every, every), "Le 15, à 0h00"],
    [
      "0 0 1,15 * *",
      schedule(value(0), value(0), values(1, 15), every, every),
      "Les 1er et 15, à 0h00",
    ],
    [
      "0 0 28-31 * *",
      schedule(value(0), value(0), range(28, 31), every, every),
      "Du 28 au 31, à 0h00",
    ],
    [
      "0 0 1 */3 *",
      schedule(value(0), value(0), value(1), step(3), every),
      "Le 1er, tous les 3 mois, à 0h00",
    ],
    // date fusion — French puts the day before the month
    [
      "0 0 25 12 *",
      schedule(value(0), value(0), value(25), value(12), every),
      "Le 25 décembre, à 0h00",
    ],
    [
      "0 0 1 1 *",
      schedule(value(0), value(0), value(1), value(1), every),
      "Le 1er janvier, à 0h00",
    ],
    [
      "0 0 */3 * *",
      schedule(value(0), value(0), step(3), every, every),
      "Chaque 3e jour du mois, à 0h00",
    ],
    // cron's OR quirk
    [
      "*/15 9-17 9 * 1-5",
      schedule(step(15), range(9, 17), value(9), every, range(1, 5)),
      "Le 9 ou du lundi au vendredi, toutes les 15 minutes entre 9h00 et 17h59",
    ],
    [
      "1-5,10 * * * *",
      schedule(union(range(1, 5), value(10)), every, every, every, every),
      "Tous les jours, aux minutes 1 à 5 et 10 de chaque heure",
    ],
  ];

  it.each(CORPUS)("rend %s", (_expression, input, expected) => {
    expect(say(input)).toBe(expected);
  });

  // --- The grammar features that make "just i18n keys" impossible ------------

  // A day clause can land at the start of the sentence, where capitalizeFirst uppercases it —
  // these assertions are about grammar, not casing, so they compare case-insensitively.
  const saidLower = (s: ScheduleDescription) => say(s).toLowerCase();

  it("agrees the determiner with the unit's gender", () => {
    // minute/heure are feminine -> "toutes les"; jour/mois are masculine -> "tous les".
    expect(saidLower(schedule(step(15), every, every, every, every))).toContain(
      "toutes les 15 minutes",
    );
    expect(saidLower(schedule(value(0), step(2), every, every, every))).toContain(
      "toutes les 2 heures",
    );
    // The two day fields deliberately leave the gendered "tous/toutes les N" frame — a
    // `*/N` there is a rank, not a rate (code review 2026-09-06) — so masculine agreement is
    // carried by the month case below.
    expect(saidLower(schedule(value(0), value(0), step(3), every, every))).toContain(
      "chaque 3e jour du mois",
    );
    expect(saidLower(schedule(value(0), value(0), value(1), step(2), every))).toContain(
      "tous les 2 mois",
    );
  });

  it("contracts de+le into du and à+le into au for spans that take an article", () => {
    expect(saidLower(schedule(value(0), value(0), range(1, 15), every, every))).toContain(
      "du 1er au 15",
    );
    expect(saidLower(schedule(value(0), value(9), every, every, range(1, 5)))).toContain(
      "du lundi au vendredi",
    );
  });

  it("elides de into d' before a vowel, and leaves it alone otherwise", () => {
    // Months take no article, so they use "de" — which must elide before avril/août/octobre.
    expect(say(schedule(value(0), value(0), every, range(3, 8), every))).toContain(
      "de mars à août",
    );
    expect(say(schedule(value(0), value(0), every, range(4, 6), every))).toContain(
      "d'avril à juin",
    );
    expect(say(schedule(value(0), value(0), every, range(10, 12), every))).toContain(
      "d'octobre à décembre",
    );
  });

  it("marks only the first ordinal, unlike English's four suffixes", () => {
    const dayOf = (n: number) => say(schedule(value(0), value(0), value(n), every, every));
    expect(dayOf(1)).toContain("Le 1er");
    expect(dayOf(2)).toContain("Le 2");
    expect(dayOf(3)).toContain("Le 3");
    expect(dayOf(21)).toContain("Le 21");
    expect(dayOf(22)).toContain("Le 22");
  });

  it("uses a 24-hour clock, not AM/PM", () => {
    expect(say(schedule(value(30), value(17), every, every, every))).toBe(
      "Tous les jours, à 17h30",
    );
    expect(say(schedule(value(0), value(0), every, every, every))).toContain("0h00");
    expect(say(schedule(value(0), value(9), every, every, every))).not.toContain("AM");
  });

  it("joins lists with 'et' and no Oxford comma, per CLDR", () => {
    // Intl.ListFormat('fr') supplies this — never hand-joined.
    expect(say(schedule(value(0), values(9, 12, 17), every, every, every))).toContain(
      "9h00, 12h00 et 17h00",
    );
  });

  it("keeps weekday and month names lowercase, capitalising only the sentence", () => {
    const sentence = say(schedule(value(0), value(9), every, value(6), value(1)));
    expect(sentence.startsWith("Tous les lundis")).toBe(true);
    expect(sentence).toContain("en juin");
    expect(sentence).not.toContain("Juin");
    expect(sentence).not.toContain("Lundi");
  });

  it("renders an unsupported field verbatim instead of guessing", () => {
    expect(say(schedule(value(0), value(0), unsupported("L"), every, every))).toContain("(L)");
  });
});

describe("frenchCronLocale.fieldPhrase", () => {
  it("names every shape in every field", () => {
    expect(frenchCronLocale.fieldPhrase("minute", every)).toBe("chaque minute");
    expect(frenchCronLocale.fieldPhrase("hour", every)).toBe("chaque heure");
    expect(frenchCronLocale.fieldPhrase("dayOfMonth", every)).toBe("chaque jour");
    expect(frenchCronLocale.fieldPhrase("month", every)).toBe("chaque mois");
    expect(frenchCronLocale.fieldPhrase("dayOfWeek", every)).toBe("chaque jour de la semaine");

    expect(frenchCronLocale.fieldPhrase("minute", value(5))).toBe("5");
    expect(frenchCronLocale.fieldPhrase("dayOfMonth", value(1))).toBe("le 1er");
    expect(frenchCronLocale.fieldPhrase("dayOfMonth", value(15))).toBe("le 15");
    expect(frenchCronLocale.fieldPhrase("month", value(6))).toBe("juin");
    expect(frenchCronLocale.fieldPhrase("dayOfWeek", value(1))).toBe("lundi");

    expect(frenchCronLocale.fieldPhrase("dayOfWeek", range(1, 5))).toBe("du lundi au vendredi");
    expect(frenchCronLocale.fieldPhrase("month", range(3, 8))).toBe("de mars à août");
    expect(frenchCronLocale.fieldPhrase("minute", step(15))).toBe("toutes les 15 minutes");
    expect(frenchCronLocale.fieldPhrase("dayOfMonth", step(7, [1, 28]))).toBe(
      "chaque 7e jour du mois du 1er au 28",
    );
    expect(frenchCronLocale.fieldPhrase("minute", values(0, 15, 30))).toBe("0, 15 et 30");
    expect(frenchCronLocale.fieldPhrase("dayOfMonth", unsupported("L"))).toBe(
      "tel qu'indiqué (L)",
    );
  });

  it("treats both 0 and 7 as dimanche", () => {
    expect(frenchCronLocale.fieldPhrase("dayOfWeek", value(0))).toBe("dimanche");
    expect(frenchCronLocale.fieldPhrase("dayOfWeek", value(7))).toBe("dimanche");
  });
});
