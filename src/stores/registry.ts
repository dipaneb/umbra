import { computed, ref, type Component } from "vue";
import { defineStore } from "pinia";
import type { RouteRecordRaw } from "vue-router";
import { createLatestWinsRunner } from "../shell/invoke";
import { matchesBase64, matchesImage, matchesJson, matchesJwt, type ClipboardContent } from "../shell/clipboardMatch";
import type { IconName } from "../shell/icons";
import type { ToolError } from "../shell/toolError";

export interface ToolRegistryEntry {
  id: string;
  name: string;
  description: string;
  aliases: string[];
  route: string;
  icon: IconName;
  component: () => Promise<Component>;
  drop?: { acceptedMimeTypes: string[]; handler: string };
  // AD-14/AD-15: declares a tool's clipboard-image-paste handler, mirroring `drop` — keeps the
  // shell's paste dispatcher generic (reads the handler name from the registry) rather than
  // hardcoding a tool's command name (Story 4.2).
  paste?: { handler: string };
  // AC3 (Story 7.8): declares a tool's eligibility for the clipboard-suggestion surface — the
  // shell (AppSidebar.vue) iterates every registered entry's `clipboardMatch` generically (AD-5)
  // rather than hardcoding which tools are eligible, so this scales past today's 7 tools with
  // zero shell-level changes. `specificity` is author-declared: when clipboard content matches
  // more than one tool, the higher `specificity` wins (AC4); ties break by stable registry order.
  clipboardMatch?: { test: (content: ClipboardContent) => boolean; specificity: number };
  shortcut?: string;
}

// Duplicate ids are a developer error, not a runtime condition — the array
// below is a hardcoded literal, never user input. Assert at module load so a
// colliding id fails loud the moment it's written, instead of surfacing
// later as sidebar/palette/routing entries silently overwriting each other.
export function assertUniqueToolIds(entries: ToolRegistryEntry[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates.add(entry.id);
    }
    seen.add(entry.id);
  }
  if (duplicates.size > 0) {
    throw new Error(
      `Duplicate tool registry id(s): ${Array.from(duplicates)
        .map((id) => `"${id}"`)
        .join(", ")}`,
    );
  }
}

// AD-5: this store is the single source of truth for every tool in the app.
// The sidebar (AppSidebar.vue), the router's route table below, and (Story
// 1.6) the ⌘K command palette are all *generated* from `tools` — none of
// them list tool names, routes, or components independently. To add a tool,
// add one entry here; don't hand-edit the sidebar or the router.
//
// Adding an entry also means updating docs/release-checklist.md's exercise
// list (Story 5.3, NFR1) — that checklist's "every tool exercised" guarantee
// is only as good as this list staying in sync with it.
const TOOLS: ToolRegistryEntry[] = [
  {
    id: "json",
    name: "JSON",
    description: "Format, validate, and explore JSON as a collapsible tree.",
    aliases: ["json", "formatter"],
    route: "/tools/json",
    icon: "json",
    component: () => import("../tools/json/JsonView.vue"),
    // specificity 2: JSON.parse succeeds on many plain strings (a bare quoted string, a bare
    // number) — looser than JWT's structurally distinctive three-segment shape, but tighter
    // than Base64's alphabet-only check (nearly any JSON string is also alphabet-valid Base64,
    // but not vice versa).
    clipboardMatch: { test: matchesJson, specificity: 2 },
  },
  {
    id: "base64",
    name: "Base64",
    description: "Encode and decode text or files to and from Base64.",
    aliases: ["base64", "b64", "decode"],
    route: "/tools/base64",
    icon: "base64",
    component: () => import("../tools/base64/Base64View.vue"),
    // Tauri's native drop event carries only filesystem paths, never a
    // browser-supplied MIME type — this field is presence-of-`.drop`-means-
    // accepts, not yet used for actual filtering (no story needs it yet).
    drop: { acceptedMimeTypes: [], handler: "base64_encode_file" },
    // specificity 1 (lowest): the base64 alphabet is a superset of JWT's per-segment alphabet
    // and overlaps heavily with JSON's, so this is the most permissive of the three text
    // matchers and most likely to collide with either — it must never outrank them.
    clipboardMatch: { test: matchesBase64, specificity: 1 },
  },
  {
    id: "uuid",
    name: "UUID",
    description: "Generate UUID v4 or v7 identifiers, single or in bulk.",
    aliases: ["uuid", "guid"],
    route: "/tools/uuid",
    icon: "uuid",
    component: () => import("../tools/uuid/UuidView.vue"),
  },
  {
    id: "hash",
    name: "Hash",
    description: "Compute SHA-256, SHA-512, MD5, and SHA-1 digests of text or files.",
    aliases: ["hash", "checksum", "sha256", "sha512", "md5", "sha1", "digest"],
    route: "/tools/hash",
    icon: "hash",
    component: () => import("../tools/hash/HashView.vue"),
    drop: { acceptedMimeTypes: [], handler: "hash_compute_file" },
  },
  {
    id: "jwt",
    name: "JWT",
    description: "Decode a JWT's header and payload, entirely offline.",
    aliases: ["jwt", "token", "decode"],
    route: "/tools/jwt",
    icon: "jwt",
    component: () => import("../tools/jwt/JwtView.vue"),
    // specificity 3 (highest of the three text matchers): a JWT-shaped string is also
    // technically three non-JSON, base64-alphabet-valid substrings, so it must outrank a looser
    // Base64 match if both somehow fire on the same content. JSON and JWT don't overlap in
    // practice (a JWT never parses as JSON), so their relative order matters less, but this
    // value is still deliberate, not arbitrary.
    clipboardMatch: { test: matchesJwt, specificity: 3 },
  },
  {
    id: "cron",
    name: "Cron",
    description: "Translate between plain English and cron expressions.",
    aliases: ["cron", "crontab", "schedule"],
    route: "/tools/cron",
    icon: "cron",
    component: () => import("../tools/cron/CronView.vue"),
  },
  {
    id: "bucket",
    name: "Bucket",
    description: "Extract text from images, and merge, split, or convert PDFs and images.",
    aliases: [
      "bucket",
      "ocr",
      "screenshot",
      "pdf",
      "merge",
      "image",
      "convert",
      "compress",
      "png",
      "jpeg",
      "webp",
    ],
    route: "/tools/bucket",
    icon: "bucket",
    component: () => import("../tools/bucket/BucketView.vue"),
    drop: { acceptedMimeTypes: [], handler: "bucket_extract_text" },
    paste: { handler: "bucket_extract_text_from_clipboard" },
    // specificity 4: highest of the four, though moot in practice — `matchesImage` only ever
    // returns true for `{ kind: "image" }` content, and every text matcher requires
    // `kind === "text"`, so an image clipboard entry can never also match a text-shape tool.
    clipboardMatch: { test: matchesImage, specificity: 4 },
  },
];

assertUniqueToolIds(TOOLS);

export const useRegistryStore = defineStore("registry", () => {
  // Each store instance gets its own array copy — `TOOLS` must stay a single
  // shared reference for the module-load assertion above, but Pinia's `ref()`
  // wraps arrays by reference rather than cloning, so reusing `TOOLS` here
  // directly would make every store instance mutate the same underlying array.
  const tools = ref<ToolRegistryEntry[]>([...TOOLS]);

  // Named routes use `tool.id` as the route name — already unique per entry,
  // so no separate field is needed. This lets other code navigate with
  // `router.push({ name: tool.id })` instead of hardcoding path strings.
  const routes = computed<RouteRecordRaw[]>(() =>
    tools.value.map((tool) => ({
      path: tool.route,
      name: tool.id,
      component: tool.component,
    })),
  );

  // AD-14: `DropZone.vue` is the shell's single generic drop dispatcher — it
  // invokes `activeTool.drop.handler` directly, but the dropped *path* is
  // the only argument it can supply on its own. Any additional,
  // tool-specific invoke arguments (e.g. Base64's `url_safe`, drawn from
  // that tool's own currently-selected radio button) come from the active
  // tool's own view via a provider registered here. Cross-tool signal lives
  // in this store, not a bare module `ref`, per AD-6.
  const dropArgsProviders = ref<Record<string, () => Record<string, unknown>>>({});
  function setDropArgsProvider(toolId: string, provider: (() => Record<string, unknown>) | null): void {
    if (provider) {
      dropArgsProviders.value[toolId] = provider;
    } else {
      delete dropArgsProviders.value[toolId];
    }
  }

  // One-shot outcome of a dispatcher-invoked drop command — set by
  // `DropZone.vue` after it invokes `activeTool.drop.handler`, consumed
  // (watched, then cleared) by the tool view that registered the provider
  // above.
  const dropResult = ref<{ toolId: string; value: unknown } | { toolId: string; error: ToolError } | null>(null);

  // One-shot outcome of a dispatcher-invoked clipboard-paste command — set by `DropZone.vue`
  // after it invokes `activeTool.paste.handler`. A separate field from `dropResult`, not a
  // repurposed one: five other tools' views already depend on `dropResult` meaning "a file-drop
  // outcome" exactly (Story 4.2's Dev Notes). Same shape, consumed the same way.
  const pasteResult = ref<{ toolId: string; value: unknown } | { toolId: string; error: ToolError } | null>(null);

  // AD-16: latest-wins must be scoped per tool, not per component instance —
  // otherwise a drop dispatched by `DropZone.vue`'s single shared dispatcher
  // and a manual invoke made by the tool's own view (e.g. Hash's "Compute"
  // button) race independently and can overwrite each other out of order,
  // and a drop for one tool can wrongly supersede an in-flight drop for a
  // different tool. One runner per `toolId`, lazily created and reused by
  // every caller for that tool, closes both gaps.
  const latestWinsRunners = new Map<string, ReturnType<typeof createLatestWinsRunner>>();
  function getLatestWinsRunner(toolId: string): ReturnType<typeof createLatestWinsRunner> {
    let runner = latestWinsRunners.get(toolId);
    if (!runner) {
      runner = createLatestWinsRunner();
      latestWinsRunners.set(toolId, runner);
    }
    return runner;
  }

  return {
    tools,
    routes,
    dropArgsProviders,
    setDropArgsProvider,
    dropResult,
    pasteResult,
    getLatestWinsRunner,
  };
});
