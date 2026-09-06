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

const LOCALE = "fr";

const MAX_CLOCK_TIMES = 6;

// French weekday and month names are lowercase — only the sentence's first letter is
// capitalised, by `capitalizeFirst` at the end.
const WEEKDAYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function weekdayName(value: number): string {
  return WEEKDAYS[value === 7 ? 0 : value] ?? String(value);
}

function monthName(value: number): string {
  return MONTHS[value - 1] ?? String(value);
}

// French marks only the first ordinal ("le 1er", then "le 2", "le 15") — a different
// algorithm from English's four suffixes, not a different string. CLDR knows this: French
// ordinal categories are "one" and "other".
function ordinal(value: number): string {
  return ordinalCategory(LOCALE, value) === "one" ? `${value}er` : String(value);
}

// A *rank* ordinal, which is a different thing from a calendar-date ordinal above. A date
// takes a cardinal after the first ("le 1er janvier", then "le 2 janvier"), but a rank always
// marks: "chaque 2e jour", never "chaque 2 jour". CLDR's "one" category still picks out 1.
function rankOrdinal(value: number): string {
  return ordinalCategory(LOCALE, value) === "one" ? `${value}er` : `${value}e`;
}

// Elision: `de` becomes `d'` before a vowel or mute h — "de mars" but "d'avril", "d'août",
// "d'octobre". No placeholder-based message system can express this, because the
// preposition mutates based on the *inserted* word.
function de(word: string): string {
  return /^[aeiouâàéèêëîïôöùûü]/i.test(word) ? `d'${word}` : `de ${word}`;
}

// Recurring wall-clock values, not instants — hand-formatted, never Intl.DateTimeFormat
// (which would need a fabricated Date and would then apply the user's timezone to it).
function clockTime(hour: number, minute: number): string {
  return `${hour}h${String(minute).padStart(2, "0")}`;
}

function hourName(hour: number): string {
  return `${hour}h`;
}

/**
 * Grammatical gender per unit noun. This is the reason "every {n} {unit}" cannot be one
 * i18n key in French: the determiner agrees with the noun it introduces.
 * minute/heure are feminine ("toutes les"); jour/mois are masculine ("tous les").
 */
const UNIT_GENDER: Record<CronFieldKind, "f" | "m"> = {
  minute: "f",
  hour: "f",
  dayOfMonth: "m",
  month: "m",
  dayOfWeek: "m",
};

// "mois" is invariable — same form singular and plural.
const UNIT_SINGULAR: Record<CronFieldKind, string> = {
  minute: "minute",
  hour: "heure",
  dayOfMonth: "jour",
  month: "mois",
  dayOfWeek: "jour de la semaine",
};

const UNIT_PLURAL: Record<CronFieldKind, string> = {
  minute: "minutes",
  hour: "heures",
  dayOfMonth: "jours",
  month: "mois",
  dayOfWeek: "jours de la semaine",
};

/** "toutes les 15 minutes" / "tous les 3 jours" — the determiner agrees with the unit. */
function everyN(kind: CronFieldKind, step: number): string {
  const all = UNIT_GENDER[kind] === "f" ? "toutes" : "tous";
  if (step === 1) return `chaque ${UNIT_SINGULAR[kind]}`;
  // See the English renderer's note: `*/N` is a genuine rate for minutes, hours and months,
  // but on the two day fields it is a selection rule that resets at the period boundary, so
  // "tous les 3 jours" states an interval the schedule does not keep (code review
  // 2026-09-06). `un jour sur trois` would imply the same interval, so name the rank.
  if (kind === "dayOfMonth") return `chaque ${rankOrdinal(step)} jour du mois`;
  if (kind === "dayOfWeek") return `chaque ${rankOrdinal(step)} jour de la semaine`;
  return `${all} les ${step} ${UNIT_PLURAL[kind]}`;
}

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

/**
 * An inclusive span. Note the contraction: `de + le` fuses to `du` and `à + le` to `au`, so
 * days take "du 1er au 15" while months — which take no article — take "de mars à août",
 * with elision on top ("d'avril").
 */
function boundsPhrase(kind: CronFieldKind, range: TermRange): string {
  switch (kind) {
    case "minute":
      return `entre la minute ${range.from} et la minute ${range.to}`;
    case "hour":
      return `entre l'heure ${range.from} et l'heure ${range.to}`;
    case "dayOfMonth":
      return `du ${ordinal(range.from)} au ${ordinal(range.to)}`;
    case "month":
      return `${de(monthName(range.from))} à ${monthName(range.to)}`;
    case "dayOfWeek":
      return `du ${weekdayName(range.from)} au ${weekdayName(range.to)}`;
  }
}

function singleBoundPhrase(kind: CronFieldKind, value: number): string {
  switch (kind) {
    case "minute":
      return `à partir de la minute ${value}`;
    case "hour":
      return `à partir de l'heure ${value}`;
    case "dayOfMonth":
      return `à partir du ${ordinal(value)}`;
    case "month":
      return `à partir ${de(monthName(value))}`;
    case "dayOfWeek":
      return `à partir du ${weekdayName(value)}`;
  }
}

function stepPhrase(
  kind: CronFieldKind,
  step: number,
  within: TermRange | null,
  from: number | null,
): string {
  const every = everyN(kind, step);
  if (within) return `${every} ${boundsPhrase(kind, within)}`;
  if (from !== null) return `${every} ${singleBoundPhrase(kind, from)}`;
  return every;
}

function partPhrase(kind: CronFieldKind, term: FieldTerm): string {
  switch (term.kind) {
    case "every":
      return "toute valeur";
    case "value":
      return valueName(kind, term.value);
    case "values":
      return valueList(kind, term.values);
    case "range":
      return `${valueName(kind, term.range.from)} à ${valueName(kind, term.range.to)}`;
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

// --- Moitié horaire --------------------------------------------------------

function minuteScope(minute: FieldTerm): string {
  switch (minute.kind) {
    case "every":
      return "chaque minute";
    case "value":
      return minute.value === 0 ? "à l'heure pile" : `à la minute ${minute.value}`;
    case "values":
      return `aux minutes ${valueList("minute", minute.values)}`;
    case "range":
      return `chaque minute ${boundsPhrase("minute", minute.range)}`;
    case "step":
      return stepPhrase("minute", minute.step, minute.within, minute.from);
    case "union":
      return `aux minutes ${partList("minute", minute.parts)}`;
    case "unsupported":
      return `aux minutes indiquées (${minute.raw})`;
  }
}

function hourQualifier(hour: FieldTerm): string {
  switch (hour.kind) {
    case "every":
      return " de chaque heure";
    case "value":
      // An hour value covers the whole hour, so name both ends rather than inventing a
      // French equivalent of "during the 9 AM hour", which has no natural short form.
      return ` entre ${clockTime(hour.value, 0)} et ${clockTime(hour.value, 59)}`;
    case "values":
      return ` à ${joinList(LOCALE, hour.values.map(hourName))}`;
    case "range":
      return ` entre ${clockTime(hour.range.from, 0)} et ${clockTime(hour.range.to, 59)}`;
    case "step":
      if (hour.within) {
        return `, toutes les ${hour.step} heures entre ${clockTime(hour.within.from, 0)} et ${clockTime(hour.within.to, 59)}`;
      }
      if (hour.from !== null) {
        return `, toutes les ${hour.step} heures à partir de ${hourName(hour.from)}`;
      }
      return hour.step === 1 ? " de chaque heure" : `, toutes les ${hour.step} heures`;
    case "union":
      return ` ${joinList(
        LOCALE,
        hour.parts.map((part) => hourQualifier(part).trimStart()),
      )}`;
    case "unsupported":
      return ` durant les heures indiquées (${hour.raw})`;
  }
}

function timeSentence(minute: FieldTerm, hour: FieldTerm): string {
  const minutes = explicitValues(minute);
  const hours = explicitValues(hour);
  if (minutes && hours && minutes.length * hours.length <= MAX_CLOCK_TIMES) {
    const times = hours.flatMap((h) => minutes.map((m) => clockTime(h, m)));
    return `à ${joinList(LOCALE, times)}`;
  }

  if (minute.kind === "every" && hour.kind === "every") return "chaque minute";
  if (minute.kind === "step" && hour.kind === "every") return minuteScope(minute);
  if (minute.kind === "value" && minute.value === 0 && hour.kind === "every") {
    return "toutes les heures";
  }
  if (minute.kind === "value" && hour.kind === "step" && !hour.within && hour.from === null) {
    const every = hour.step === 1 ? "toutes les heures" : `toutes les ${hour.step} heures`;
    return minute.value === 0 ? every : `${every} à la minute ${minute.value}`;
  }

  return `${minuteScope(minute)}${hourQualifier(hour)}`;
}

// --- Moitié calendaire -----------------------------------------------------

function domScope(dom: FieldTerm): string {
  switch (dom.kind) {
    case "every":
      return "tous les jours";
    case "value":
      return `le ${ordinal(dom.value)}`;
    case "values":
      return `les ${valueList("dayOfMonth", dom.values)}`;
    case "range":
      return boundsPhrase("dayOfMonth", dom.range);
    case "step":
      return stepPhrase("dayOfMonth", dom.step, dom.within, dom.from);
    case "union":
      // Each part renders through `domScope` itself, so it keeps its own article and
      // contraction ("du 1er au 5", "le 10"). Joining bare part phrases under one shared
      // "les " prefix produced "les 1er à 5 et 10" — the exact class of breakage the
      // per-locale renderer split exists to avoid.
      return joinList(LOCALE, dom.parts.map(domScope));
    case "unsupported":
      return `les jours indiqués (${dom.raw})`;
  }
}

function dowScope(dow: FieldTerm): string {
  switch (dow.kind) {
    case "every":
      return "tous les jours de la semaine";
    case "value":
      // "tous les lundis" — the weekday pluralises.
      return `tous les ${weekdayName(dow.value)}s`;
    case "values":
      return `tous les ${joinList(LOCALE, dow.values.map((d) => `${weekdayName(d)}s`))}`;
    case "range":
      return boundsPhrase("dayOfWeek", dow.range);
    case "step":
      return stepPhrase("dayOfWeek", dow.step, dow.within, dow.from);
    case "union":
      return joinList(LOCALE, dow.parts.map(dowScope));
    case "unsupported":
      return `les jours indiqués (${dow.raw})`;
  }
}

function monthQualifier(month: FieldTerm): string {
  switch (month.kind) {
    case "every":
      return "";
    case "value":
      return ` en ${monthName(month.value)}`;
    case "values":
      return ` en ${valueList("month", month.values)}`;
    case "range":
      return ` ${boundsPhrase("month", month.range)}`;
    case "step":
      if (month.within) {
        return `, tous les ${month.step} mois ${boundsPhrase("month", month.within)}`;
      }
      if (month.from !== null) {
        return `, tous les ${month.step} mois ${singleBoundPhrase("month", month.from)}`;
      }
      return month.step === 1 ? "" : `, tous les ${month.step} mois`;
    case "union":
      // "de janvier à mars et en juin" — a range takes `de`, a bare month takes `en`, so the
      // preposition belongs to each part, never to the join.
      return ` ${joinList(
        LOCALE,
        month.parts.map((part) => monthQualifier(part).trimStart()),
      )}`;
    case "unsupported":
      return ` durant les mois indiqués (${month.raw})`;
  }
}

function daySentence(schedule: ScheduleDescription): string {
  const { day_of_month: dom, month, day_of_week: dow, day_match: dayMatch } = schedule;

  // "le 25 décembre" — French puts the day before the month, the reverse of English.
  if (dom.kind === "value" && month.kind === "value" && dayMatch === "day_of_month_only") {
    return `le ${ordinal(dom.value)} ${monthName(month.value)}`;
  }

  let base: string;
  switch (dayMatch) {
    case "every_day":
      base = "tous les jours";
      break;
    case "day_of_week_only":
      base = dowScope(dow);
      break;
    case "day_of_month_only":
      base = domScope(dom);
      break;
    case "either_day_field":
      base = `${domScope(dom)} ou ${dowScope(dow)}`;
      break;
  }

  return `${base}${monthQualifier(month)}`;
}

function capitalizeFirst(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

export const frenchCronLocale: CronLocale = {
  sentence(schedule: ScheduleDescription): string {
    return capitalizeFirst(
      `${daySentence(schedule)}, ${timeSentence(schedule.minute, schedule.hour)}`,
    );
  },

  fieldPhrase(kind: CronFieldKind, term: FieldTerm): string {
    switch (term.kind) {
      case "every":
        return kind === "minute"
          ? "chaque minute"
          : kind === "hour"
            ? "chaque heure"
            : kind === "dayOfMonth"
              ? "chaque jour"
              : kind === "month"
                ? "chaque mois"
                : "chaque jour de la semaine";
      case "value":
        // Both consumers (the breakdown row and the box hover title) already print the
        // field's own label, so repeating the noun here read as "Minute: minute 0".
        if (kind === "minute" || kind === "hour") return String(term.value);
        if (kind === "dayOfMonth") return `le ${ordinal(term.value)}`;
        return valueName(kind, term.value);
      case "values":
        if (kind === "minute" || kind === "hour") return valueList(kind, term.values);
        if (kind === "dayOfMonth") return `les ${valueList(kind, term.values)}`;
        return valueList(kind, term.values);
      case "range":
        if (kind === "minute") return `minutes ${term.range.from} à ${term.range.to}`;
        if (kind === "hour") return `heures ${term.range.from} à ${term.range.to}`;
        return boundsPhrase(kind, term.range);
      case "step":
        return stepPhrase(kind, term.step, term.within, term.from);
      case "union":
        if (kind === "minute") return `minutes ${partList(kind, term.parts)}`;
        if (kind === "hour") return `heures ${partList(kind, term.parts)}`;
        if (kind === "dayOfMonth") return `les ${partList(kind, term.parts)}`;
        return partList(kind, term.parts);
      case "unsupported":
        return `tel qu'indiqué (${term.raw})`;
    }
  },
};
