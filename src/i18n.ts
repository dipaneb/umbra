import { createI18n, type I18nOptions } from "vue-i18n";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// legacy: false selects the Composition API (`useI18n()`/`$t` in templates,
// `i18n.global.t` outside components) — the Legacy API's `VueI18n` instance
// shape is deprecated as of v11 (Context7-confirmed against the v11 docs).
// `en` is both the boot default (main.ts applies the real resolved locale
// before first paint, per src/shell/locale.ts) and the fallback: a missing
// French key renders the English string rather than a raw key name.
// Named number formats, per Intl.NumberFormat options — n() takes a format
// *name*, not an inline options object (Context7-confirmed against the v11
// docs). Every documented example calls n() with an explicit key, so this
// registers one for every numeric call site in the app rather than relying
// on n()'s unspecified no-key behavior:
//  - "grouped": UuidView.vue's max-count bound — grouped integer, locale
//    thousands separator (e.g. "4 294 967 295" in French vs "4,294,967,295").
//  - "decimal1": BucketView.vue's estimated-file-size display — fixed
//    one-decimal precision, locale decimal separator (comma in French).
const groupedFormat = { style: "decimal", maximumFractionDigits: 0 } as const;
const oneDecimalFormat = { style: "decimal", minimumFractionDigits: 1, maximumFractionDigits: 1 } as const;

const options: I18nOptions = {
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: { en, fr },
  numberFormats: {
    en: { grouped: groupedFormat, decimal1: oneDecimalFormat },
    fr: { grouped: groupedFormat, decimal1: oneDecimalFormat },
  },
  // fr's cardinal plural rule differs from en's: 0 and 1 are both the
  // singular ("one") category in French, versus only 1 in English. This app
  // deliberately avoids relying on vue-i18n's built-in `|`-pipe plural
  // syntax (whose exact default index mapping for 3+ forms isn't
  // straightforward to verify without a running app) — every plural site in
  // this codebase instead selects an explicit "…CountOne"/"…CountOther" key
  // in TypeScript. This pluralRules entry exists only as a defensive default
  // in case a future contributor reaches for the `|` syntax directly; it is
  // not exercised by this app's own messages.
  pluralRules: {
    fr: (choice: number, choicesLength: number) => {
      if (choice === 0 || choice === 1) return 0;
      return choicesLength < 2 ? 0 : 1;
    },
  },
};

export const i18n = createI18n<false, typeof options>(options);
