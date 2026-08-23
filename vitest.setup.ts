import { config } from "@vue/test-utils";
import { i18n } from "./src/i18n";

// Forces English regardless of the machine running the suite — every
// existing test asserts on the English strings (aria-labels used as
// selectors, button text, etc.), and this keeps those assertions valid
// unchanged rather than requiring a locale-aware rewrite of ~33 spec files.
// French-specific behavior (locale switching, French string rendering,
// plural forms) gets its own dedicated tests instead (locale.spec.ts,
// locales.spec.ts, and a French-locale render pass over the shell
// components) rather than flipping this global default.
i18n.global.locale.value = "en";

// Registered on config.global (not per-mount) so every existing spec's own
// `mount(Component, { global: { plugins: [...] } })` call still gets i18n —
// @vue/test-utils merges config.global.plugins with a mount's own
// global.plugins array rather than one replacing the other.
config.global.plugins = [i18n];
