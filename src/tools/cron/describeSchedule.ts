import type { SupportedLocale } from "../../shell/locale";
import type { CronLocale } from "./locales/cronLocale";
import { englishCronLocale } from "./locales/en";
import { frenchCronLocale } from "./locales/fr";

// One renderer per shipped locale. Adding a language is adding a row here plus its module —
// core doesn't change, because core never knew about languages in the first place.
const CRON_LOCALES: Record<SupportedLocale, CronLocale> = {
  en: englishCronLocale,
  fr: frenchCronLocale,
};

export function cronLocaleFor(locale: SupportedLocale): CronLocale {
  return CRON_LOCALES[locale] ?? englishCronLocale;
}
