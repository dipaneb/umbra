import { computed, ref, type Component } from "vue";
import { defineStore } from "pinia";
import type { RouteRecordRaw } from "vue-router";
import { createLatestWinsRunner } from "../shell/invoke";
import { matchesBase64, matchesImage, matchesJson, matchesJwt, type ClipboardContent } from "../shell/clipboardMatch";
import type { IconName } from "../shell/icons";
import type { ToolError } from "../shell/toolError";

export interface ToolRegistryEntry {
  id: string;
  // Proper noun/standard identifier ("JSON", "Base64", "JWT") — deliberately
  // NOT translated, same reasoning as algorithm names in HashView.vue.
  name: string;
  // An i18n key (tools.<id>.description), not the string itself — resolved
  // by whichever view renders it (GridHome.vue) via t(), so this registry
  // stays locale-independent data, consistent with `name` and `aliases`
  // below.
  descriptionKey: string;
  // Union of English AND French search terms, not a per-locale list: a
  // French user searching "decode" and an English user searching "décoder"
  // should both find the tool — partitioning by locale would only narrow
  // ⌘K, never improve it. paletteSearch.ts normalizes diacritics on both
  // sides, so "cle"/"clé" match each other regardless of which one is typed.
  aliases: string[];
  route: string;
  icon: IconName;
  component: () => Promise<Component>;
  // AC33 (Story 8.8): `multiple` is ADDITIVE. A tool that does not declare it receives exactly
  // today's behaviour — its handler is invoked with `path`, the first dropped file. A tool that
  // does receives `paths`, the whole array. Only the `pdf` entry sets it, because merging several
  // PDFs is the one drop gesture in this app that is meaningless with a single file, and Story
  // 6.1 declined drop for this tool partly *because* `DropZone.vue` discarded every file after
  // the first (`paths![0]`). That truncation is what this flag exists to stop being a silent one.
  drop?: { acceptedMimeTypes: string[]; handler: string; multiple?: boolean };
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
    descriptionKey: "tools.json.description",
    aliases: ["json", "formatter", "formateur"],
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
    descriptionKey: "tools.base64.description",
    aliases: ["base64", "b64", "decode", "décoder", "encoder"],
    route: "/tools/base64",
    icon: "base64",
    component: () => import("../tools/base64/Base64View.vue"),
    // Tauri's native drop event carries only filesystem paths, never a
    // browser-supplied MIME type — this field is presence-of-`.drop`-means-
    // accepts, not yet used for actual filtering (no story needs it yet).
    drop: { acceptedMimeTypes: [], handler: "base64_ingest_file" },
    // specificity 1 (lowest): the base64 alphabet is a superset of JWT's per-segment alphabet
    // and overlaps heavily with JSON's, so this is the most permissive of the three text
    // matchers and most likely to collide with either — it must never outrank them.
    clipboardMatch: { test: matchesBase64, specificity: 1 },
  },
  {
    id: "uuid",
    name: "UUID",
    descriptionKey: "tools.uuid.description",
    aliases: ["uuid", "guid", "identifiant"],
    route: "/tools/uuid",
    icon: "uuid",
    component: () => import("../tools/uuid/UuidView.vue"),
  },
  {
    id: "hash",
    name: "Hash",
    descriptionKey: "tools.hash.description",
    aliases: [
      "hash",
      "checksum",
      "sha256",
      "sha512",
      "sha3",
      "sha3-256",
      "sha3-512",
      "md5",
      "sha1",
      "digest",
      "hachage",
      "empreinte",
    ],
    route: "/tools/hash",
    icon: "hash",
    component: () => import("../tools/hash/HashView.vue"),
    drop: { acceptedMimeTypes: [], handler: "hash_compute_file" },
  },
  {
    id: "jwt",
    name: "JWT",
    descriptionKey: "tools.jwt.description",
    aliases: ["jwt", "token", "decode", "jeton"],
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
    descriptionKey: "tools.cron.description",
    aliases: ["cron", "crontab", "schedule", "planification", "horaire"],
    route: "/tools/cron",
    icon: "cron",
    component: () => import("../tools/cron/CronView.vue"),
  },
  // Story 8.7 (AC7): the single `bucket` entry is retired and replaced by three.
  // It was never a product decision — an AI scaffolded three unrelated tools under
  // one name and it was left unfixed. The entry actively lied twice: `drop`, `paste`
  // and `clipboardMatch` were all OCR-only despite sitting on a tool that also
  // claimed PDF and image conversion, and its 16 aliases meant typing "merge" or
  // "webp" in ⌘K returned a result named "Bucket". The aliases partition below; the
  // retired `bucket` alias is not carried onto any entry.
  {
    id: "ocr",
    name: "Image to Text",
    descriptionKey: "tools.ocr.description",
    aliases: ["ocr", "screenshot", "text", "capture d'écran", "texte"],
    route: "/tools/ocr",
    icon: "ocr",
    component: () => import("../tools/ocr/OcrView.vue"),
    // All three behavioural declarations move here and here only: PDF and Images
    // reach the filesystem through their own open()/save() dialogs and never touch
    // drop or paste.
    drop: { acceptedMimeTypes: [], handler: "ocr_extract_text" },
    paste: { handler: "ocr_extract_text_from_clipboard" },
    // specificity 4: highest of the four, though moot in practice — `matchesImage` only ever
    // returns true for `{ kind: "image" }` content, and every text matcher requires
    // `kind === "text"`, so an image clipboard entry can never also match a text-shape tool.
    clipboardMatch: { test: matchesImage, specificity: 4 },
  },
  {
    // `name` is provisional — Story 8.8 redesigns this tool and may rename it, but
    // the registry cannot hold a placeholder (AC28).
    id: "pdf",
    // AC35: `name` STAYS "PDF". Story 8.7 marked it provisional and left the call to this story;
    // leaving it is the recorded decision, not an oversight — "PDF" already holds the two-word
    // register's spirit as a proper noun.
    name: "PDF",
    descriptionKey: "tools.pdf.description",
    // AC35: the five original aliases plus the three verbs this story added, in both locales.
    aliases: [
      "pdf",
      "merge",
      "split",
      "rotate",
      "delete",
      "reorder",
      "fusionner",
      "diviser",
      "pivoter",
      "supprimer",
      "réorganiser",
    ],
    route: "/tools/pdf",
    icon: "pdf",
    // AC5/AC33: drop adopted, and multi-file. Story 6.1 declined it deliberately and gave three
    // reasons; Story 8.7 killed one of them (the shared `bucket` entry could not route a PDF and
    // an image to two different handlers — PDF now has its own entry and its own handler),
    // `dropArgsProviders` had already solved the second, and `multiple` here answers the third.
    drop: { acceptedMimeTypes: ["application/pdf"], handler: "pdf_open_dropped", multiple: true },
    component: () => import("../tools/pdf/PdfView.vue"),
  },
  {
    // AC4b: `"Images"`, not the provisional `"Image"` Story 8.7 shipped — matches the
    // epic/story title and reads as a proper noun the way `"PDF"` does, rather than a
    // category label that never got finished.
    id: "image",
    name: "Images",
    descriptionKey: "tools.image.description",
    aliases: [
      "image",
      "images",
      "convert",
      "compress",
      "resize",
      "png",
      "jpeg",
      "webp",
      "avif",
      "convertir",
      "compresser",
      "redimensionner",
    ],
    route: "/tools/image",
    icon: "image",
    // AC5/AC14: drop adopted, multi-file — the first decision for this tool, not a
    // re-decision (unlike PDF's Story 6.1 history). Reuses the exact additive shape Story
    // 8.8 already built rather than inventing a second one.
    drop: { acceptedMimeTypes: [], handler: "image_ingest_dropped", multiple: true },
    component: () => import("../tools/image/ImageView.vue"),
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

  // The filesystem path of the file behind the current *successful*
  // `dropResult` (null on an error outcome or before any drop). A sibling
  // field, not folded into `dropResult` — same reasoning as `pasteResult`:
  // views that only need the outcome must not have to widen their
  // result-shape checks. Read by a view that has to re-invoke its own file
  // handler after the drop — e.g. Hash re-hashing the dropped file when the
  // selected algorithm set changes (Story 8.4), for which the one-shot
  // `hash_compute_file` dispatch alone isn't enough. Tagged with `toolId`
  // like `dropResult` (code review, Story 8.4) — the pairing is safe today
  // (only one consumer, gated by `isStillActive`/`superseded`), but an
  // untagged shared field is a footgun for a future second consumer.
  //
  // AC34 (Story 8.8): widened ADDITIVELY. `path` stays and keeps its meaning — the first dropped
  // file — so both existing consumers (`HashView.vue`, `OcrView.vue`) read it unchanged. `paths`
  // is new and carries every dropped file, and is populated for every drop rather than only for
  // `multiple` tools: a single-file drop is simply a one-element array, and a field that
  // sometimes exists is harder to reason about than one that always does.
  const dropSourcePath = ref<{ toolId: string; path: string; paths: string[] } | null>(null);

  // AC37 (Story 8.8): a one-shot hand-off of a file from one tool to another — today, a PDF
  // dropped on Image to Text being carried across to the PDF tool.
  //
  // Shell-owned on purpose. AD-6 says no tool reads another tool's state, so OCR cannot call into
  // PDF and PDF cannot reach back: the sender writes this and routes, the receiver consumes and
  // clears it on mount. Exactly the shape `dropSourcePath` already has, and the reason Story 8.7
  // deferred this hand-off (*"it cannot route to somewhere that is not built yet"*) is retired by
  // the PDF tool now having an entry state to route INTO.
  const handOffPath = ref<{ toolId: string; path: string } | null>(null);

  // AC12 (Story 8.7): the pixels behind the current *successful* `pasteResult`.
  //
  // The drop and file-picker paths hand the view a filesystem path (`dropSourcePath`), which
  // `convertFileSrc` turns into something an `<img>` can load. The paste path has no file at
  // all: `dispatchPaste` below reads `{ rgba, width, height }` from the clipboard, ships the
  // bytes as a raw IPC body and drops them on the floor. So Live Text would have silently
  // worked on drop and pick but not on paste — the exact mirror of the route this story's
  // discovery rejected unanimously ("a feature that silently works on paste and not on drop is
  // the worst option on the table").
  //
  // The fix is AD-14-shaped: the shell PUBLISHES what it has already read, rather than the view
  // reading the clipboard a second time. A second read would be a second OS I/O edge — and racy,
  // since the clipboard can change during the ~3 s inference.
  const pasteSourceImage = ref<{
    toolId: string;
    rgba: Uint8Array;
    width: number;
    height: number;
  } | null>(null);

  // AC14 (Story 8.7): which tool's view should render a drag-over highlight, or null.
  //
  // Drop dispatch itself stays window-level and unchanged — this is an *affordance*, not a hit
  // area. The view uses it to light up its drop target while a drag is over the window.
  //
  // Tagged with `toolId` rather than published as a bare boolean, following the lesson already
  // written into `dropSourcePath` above: an untagged shared field is a footgun for a future
  // second consumer. Only the active tool can be dragged onto today, so the tag is redundant
  // now and cheap insurance later.
  const dragOverToolId = ref<string | null>(null);

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
    dropSourcePath,
    handOffPath,
    pasteResult,
    pasteSourceImage,
    dragOverToolId,
    getLatestWinsRunner,
  };
});
