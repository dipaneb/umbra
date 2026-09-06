import type {
  CronFieldKind,
  FieldTerm,
  ScheduleDescription,
} from "../scheduleDescription";

/**
 * What every language must be able to produce from a `ScheduleDescription`.
 *
 * Deliberately NOT a template-filling framework. Each locale implements this interface as a
 * standalone renderer, because the parts that differ between languages are structural, not
 * lexical: French agrees determiners with noun gender (`toutes les minutes` / `tous les
 * jours`), contracts prepositions with articles (`du 1er au 15`), marks only the first
 * ordinal (`le 1er`, `le 2`), and writes clock time as `9h00`. A shared "sentence frame"
 * parameterised by strings fits English and French for about a week and then breaks on the
 * first language with different word order.
 *
 * The cost of a standalone renderer per language is real but bounded: roughly a dozen phrase
 * forms per clause plus an assembly rule. The cost of the wrong abstraction is unbounded.
 */
export interface CronLocale {
  /** The one-line prose sentence, e.g. "Every weekday, at 9:00 AM". */
  sentence(schedule: ScheduleDescription): string;
  /** One field's standalone phrase for the breakdown row, e.g. "every 15 minutes". */
  fieldPhrase(kind: CronFieldKind, term: FieldTerm): string;
}

// --- Shared, locale-parameterised helpers ----------------------------------
//
// These lean on the platform's own CLDR data (Intl) rather than hand-rolled tables, which is
// the whole reason `Intl.ListFormat` and `Intl.PluralRules` exist. A locale renderer may use
// them or not.

const listFormatters = new Map<string, Intl.ListFormat>();

/**
 * "A, B, and C" / "A, B et C" — conjunction rules and the Oxford comma are CLDR data, per
 * locale, so this must never be hand-joined with a hardcoded ", and ".
 */
export function joinList(locale: string, items: string[]): string {
  let formatter = listFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
    listFormatters.set(locale, formatter);
  }
  return formatter.format(items);
}

const ordinalRules = new Map<string, Intl.PluralRules>();

/**
 * The CLDR *ordinal* plural category for a number ("one" / "two" / "few" / "other" in
 * English). A locale maps those categories to its own suffixes — English needs four
 * (1st/2nd/3rd/4th), French effectively one (1er, then bare).
 */
export function ordinalCategory(locale: string, value: number): Intl.LDMLPluralRule {
  let rules = ordinalRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale, { type: "ordinal" });
    ordinalRules.set(locale, rules);
  }
  return rules.select(value);
}

/**
 * Expands the values a term names, when it names a small explicit set — used by renderers
 * that fuse minute+hour into clock times. Ranges and steps deliberately don't expand: they
 * read worse spelled out, and a range can be 60 values wide.
 */
export function explicitValues(term: FieldTerm): number[] | null {
  if (term.kind === "value") return [term.value];
  if (term.kind === "values") return term.values;
  return null;
}
