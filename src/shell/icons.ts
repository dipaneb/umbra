import type { Component } from "vue";
import {
  PhBracketsCurly,
  PhBinary,
  PhFingerprint,
  PhHash,
  PhKey,
  PhClock,
  PhArchive,
} from "@phosphor-icons/vue";

// One key per current registry tool id (src/stores/registry.ts) — an
// unmapped id is a compile-time error here, not a runtime gap.
export type IconName = "json" | "base64" | "uuid" | "hash" | "jwt" | "cron" | "bucket";

// `Record<IconName, Component>` makes this exhaustive at compile time: an
// entry can't be missing without a TypeScript error, so no separate runtime
// "all icons resolved" guard is needed.
const ICONS: Record<IconName, Component> = {
  json: PhBracketsCurly,
  base64: PhBinary,
  uuid: PhFingerprint,
  hash: PhHash,
  jwt: PhKey,
  cron: PhClock,
  bucket: PhArchive,
};

export function resolveIcon(name: IconName): Component {
  return ICONS[name];
}

export const ALL_ICON_NAMES = Object.keys(ICONS) as IconName[];
