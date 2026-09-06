import type {
  CronFieldKind,
  FieldTerm,
  ScheduleDescription,
  TermRange,
} from "../scheduleDescription";
import {
  explicitValues,
  joinList,
  ordinalCategory,
  type CronLocale,
} from "./cronLocale";

const LOCALE = "en";

// Above this many distinct clock times the "at 9:00 AM, 12:00 PM, and 6:00 PM" fusion stops
// reading as a list and the compositional path is clearer.
const MAX_CLOCK_TIMES = 6;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function weekdayName(value: number): string {
  // Cron accepts both 0 and 7 for Sunday.
  return WEEKDAYS[value === 7 ? 0 : value] ?? String(value);
}

function monthName(value: number): string {
  return MONTHS[value - 1] ?? String(value);
}

const ORDINAL_SUFFIX: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
};

function ordinal(value: number): string {
  return `${value}${ORDINAL_SUFFIX[ordinalCategory(LOCALE, value)] ?? "th"}`;
}

// These are recurring wall-clock values, not instants — deliberately hand-formatted rather
// than run through Intl.DateTimeFormat, which would need a fabricated Date and would then
// apply the user's timezone to it.
function clockTime(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function hourName(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12} ${period}`;
}

/** How a bare number reads in its own field. */
function valueName(kind: CronFieldKind, value: number): string {
  if (kind === "dayOfMonth") return ordinal(value);
  if (kind === "month") return monthName(value);
  if (kind === "dayOfWeek") return weekdayName(value);
  return String(value);
}

function valueList(kind: CronFieldKind, values: number[]): string {
  return joinList(
    LOCALE,
    values.map((value) => valueName(kind, value)),
  );
}

const UNIT_SINGULAR: Record<CronFieldKind, string> = {
  minute: "minute",
  hour: "hour",
  dayOfMonth: "day",
  month: "month",
  dayOfWeek: "day of the week",
};

const UNIT_PLURAL: Record<CronFieldKind, string> = {
  minute: "minutes",
  hour: "hours",
  dayOfMonth: "days",
  month: "months",
  dayOfWeek: "days of the week",
};

/** An inclusive span, named the way its own field names things. */
function boundsPhrase(kind: CronFieldKind, range: TermRange): string {
  if (kind === "minute") return `minute ${range.from} through ${range.to}`;
  if (kind === "hour") return `hour ${range.from} through ${range.to}`;
  if (kind === "dayOfMonth") {
    return `the ${ordinal(range.from)} through the ${ordinal(range.to)}`;
  }
  return `${valueName(kind, range.from)} through ${valueName(kind, range.to)}`;
}

function singleBoundPhrase(kind: CronFieldKind, value: number): string {
  if (kind === "minute") return `minute ${value}`;
  if (kind === "hour") return `hour ${value}`;
  if (kind === "dayOfMonth") return `the ${ordinal(value)}`;
  return valueName(kind, value);
}

function stepPhrase(
  kind: CronFieldKind,
  step: number,
  within: TermRange | null,
  from: number | null,
): string {
  const every =
    step === 1 ? `every ${UNIT_SINGULAR[kind]}` : `every ${step} ${UNIT_PLURAL[kind]}`;
  if (within) return `${every} from ${boundsPhrase(kind, within)}`;
  if (from !== null) return `${every} from ${singleBoundPhrase(kind, from)}`;
  return every;
}

/** One part of a union, rendered bare so the caller's preposition carries the sentence. */
function partPhrase(kind: CronFieldKind, term: FieldTerm): string {
  switch (term.kind) {
    case "every":
      return "any";
    case "value":
      return valueName(kind, term.value);
    case "values":
      return valueList(kind, term.values);
    case "range":
      return `${valueName(kind, term.range.from)} through ${valueName(kind, term.range.to)}`;
    case "step":
      return stepPhrase(kind, term.step, term.within, term.from);
    case "union":
      return partList(kind, term.parts);
    case "unsupported":
      return term.raw;
  }
}

function partList(kind: CronFieldKind, parts: FieldTerm[]): string {
  return joinList(
    LOCALE,
    parts.map((part) => partPhrase(kind, part)),
  );
}

// --- Time half -------------------------------------------------------------

/** What happens within an hour. */
function minuteScope(minute: FieldTerm): string {
  switch (minute.kind) {
    case "every":
      return "every minute";
    case "value":
      return minute.value === 0 ? "on the hour" : `at minute ${minute.value}`;
    case "values":
      return `at minutes ${valueList("minute", minute.values)}`;
    case "range":
      return `every minute from minute ${minute.range.from} through ${minute.range.to}`;
    case "step":
      return stepPhrase("minute", minute.step, minute.within, minute.from);
    case "union":
      return `at minutes ${partList("minute", minute.parts)}`;
    case "unsupported":
      return `at minutes as specified (${minute.raw})`;
  }
}

/** Which hours those minutes apply to. */
function hourQualifier(hour: FieldTerm): string {
  switch (hour.kind) {
    case "every":
      return " of every hour";
    case "value":
      return ` during the ${hourName(hour.value)} hour`;
    case "values":
      return ` during the ${joinList(LOCALE, hour.values.map(hourName))} hours`;
    case "range":
      // An hour range is inclusive of the whole final hour (`9-17` matches until 5:59 PM),
      // so name that boundary outright rather than describing an exclusive end.
      return ` between ${clockTime(hour.range.from, 0)} and ${clockTime(hour.range.to, 59)}`;
    case "step":
      if (hour.within) {
        return `, every ${hour.step} hours between ${clockTime(hour.within.from, 0)} and ${clockTime(hour.within.to, 59)}`;
      }
      if (hour.from !== null) {
        return `, every ${hour.step} hours from ${hourName(hour.from)}`;
      }
      return hour.step === 1 ? " of every hour" : `, every ${hour.step} hours`;
    case "union":
      return ` during the ${partList("hour", hour.parts)} hours`;
    case "unsupported":
      return ` during hours as specified (${hour.raw})`;
  }
}

function timeSentence(minute: FieldTerm, hour: FieldTerm): string {
  // Idiom: real clock times, the strongest fusion English has for minute + hour.
  const minutes = explicitValues(minute);
  const hours = explicitValues(hour);
  if (minutes && hours && minutes.length * hours.length <= MAX_CLOCK_TIMES) {
    const times = hours.flatMap((h) => minutes.map((m) => clockTime(h, m)));
    return `at ${joinList(LOCALE, times)}`;
  }

  if (minute.kind === "every" && hour.kind === "every") return "every minute";
  // A minute *rate* already says it repeats every hour — "every 15 minutes of every hour"
  // adds nothing, so the hour qualifier is dropped.
  if (minute.kind === "step" && hour.kind === "every") return minuteScope(minute);
  if (minute.kind === "value" && minute.value === 0 && hour.kind === "every") {
    return "every hour";
  }
  if (minute.kind === "value" && hour.kind === "step" && !hour.within && hour.from === null) {
    const every = hour.step === 1 ? "every hour" : `every ${hour.step} hours`;
    return minute.value === 0
      ? every
      : `${every} at ${minute.value} minutes past the hour`;
  }

  return `${minuteScope(minute)}${hourQualifier(hour)}`;
}

// --- Day half --------------------------------------------------------------

function domScope(dom: FieldTerm): string {
  switch (dom.kind) {
    case "every":
      return "every day";
    case "value":
      return `on the ${ordinal(dom.value)}`;
    case "values":
      return `on the ${valueList("dayOfMonth", dom.values)}`;
    case "range":
      return `on ${boundsPhrase("dayOfMonth", dom.range)}`;
    case "step":
      return stepPhrase("dayOfMonth", dom.step, dom.within, dom.from);
    case "union":
      return `on the ${partList("dayOfMonth", dom.parts)}`;
    case "unsupported":
      return `on days as specified (${dom.raw})`;
  }
}

function dowScope(dow: FieldTerm): string {
  switch (dow.kind) {
    case "every":
      return "every day of the week";
    case "value":
      return `every ${weekdayName(dow.value)}`;
    case "values":
      return `every ${valueList("dayOfWeek", dow.values)}`;
    case "range":
      // Monday-to-Friday is "every weekday" to anyone who reads a crontab.
      if (dow.range.from === 1 && dow.range.to === 5) return "every weekday";
      return `every ${weekdayName(dow.range.from)} through ${weekdayName(dow.range.to)}`;
    case "step":
      return stepPhrase("dayOfWeek", dow.step, dow.within, dow.from);
    case "union":
      return `every ${partList("dayOfWeek", dow.parts)}`;
    case "unsupported":
      return `on weekdays as specified (${dow.raw})`;
  }
}

function monthQualifier(month: FieldTerm): string {
  switch (month.kind) {
    case "every":
      return "";
    case "value":
      return ` in ${monthName(month.value)}`;
    case "values":
      return ` in ${valueList("month", month.values)}`;
    case "range":
      return ` from ${monthName(month.range.from)} through ${monthName(month.range.to)}`;
    case "step":
      if (month.within) {
        return `, every ${month.step} months from ${monthName(month.within.from)} through ${monthName(month.within.to)}`;
      }
      if (month.from !== null) {
        return `, every ${month.step} months from ${monthName(month.from)}`;
      }
      return month.step === 1 ? "" : `, every ${month.step} months`;
    case "union":
      return ` in ${partList("month", month.parts)}`;
    case "unsupported":
      return ` in months as specified (${month.raw})`;
  }
}

function daySentence(schedule: ScheduleDescription): string {
  const { day_of_month: dom, month, day_of_week: dow, day_match: dayMatch } = schedule;

  // Idiom: a specific date fuses into "December 25th".
  if (dom.kind === "value" && month.kind === "value" && dayMatch === "day_of_month_only") {
    return `on ${monthName(month.value)} ${ordinal(dom.value)}`;
  }

  let base: string;
  switch (dayMatch) {
    case "every_day":
      base = "every day";
      break;
    case "day_of_week_only":
      base = dowScope(dow);
      break;
    case "day_of_month_only":
      base = domScope(dom);
      break;
    // Cron's own quirk: with both day fields restricted the schedule fires on either, not
    // both. "or" is the only honest rendering.
    case "either_day_field":
      base = `${domScope(dom)} or ${dowScope(dow)}`;
      break;
  }

  return `${base}${monthQualifier(month)}`;
}

function capitalizeFirst(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

export const englishCronLocale: CronLocale = {
  sentence(schedule: ScheduleDescription): string {
    return capitalizeFirst(
      `${daySentence(schedule)}, ${timeSentence(schedule.minute, schedule.hour)}`,
    );
  },

  fieldPhrase(kind: CronFieldKind, term: FieldTerm): string {
    switch (term.kind) {
      case "every":
        return kind === "minute"
          ? "every minute"
          : kind === "hour"
            ? "every hour"
            : kind === "dayOfMonth"
              ? "every day"
              : kind === "month"
                ? "every month"
                : "every day of the week";
      case "value":
        if (kind === "minute") return `minute ${term.value}`;
        if (kind === "hour") return `hour ${term.value}`;
        if (kind === "dayOfMonth") return `the ${ordinal(term.value)}`;
        return valueName(kind, term.value);
      case "values":
        if (kind === "minute") return `minutes ${valueList(kind, term.values)}`;
        if (kind === "hour") return `hours ${valueList(kind, term.values)}`;
        if (kind === "dayOfMonth") return `the ${valueList(kind, term.values)}`;
        return valueList(kind, term.values);
      case "range":
        if (kind === "minute") return `minutes ${term.range.from} through ${term.range.to}`;
        if (kind === "hour") return `hours ${term.range.from} through ${term.range.to}`;
        return boundsPhrase(kind, term.range);
      case "step":
        return stepPhrase(kind, term.step, term.within, term.from);
      case "union":
        if (kind === "minute") return `minutes ${partList(kind, term.parts)}`;
        if (kind === "hour") return `hours ${partList(kind, term.parts)}`;
        if (kind === "dayOfMonth") return `the ${partList(kind, term.parts)}`;
        return partList(kind, term.parts);
      case "unsupported":
        return `as specified (${term.raw})`;
    }
  },
};
