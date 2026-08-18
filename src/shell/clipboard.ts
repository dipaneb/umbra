import { readImage, readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { listen } from "@tauri-apps/api/event";

export async function readClipboardText(): Promise<string> {
  return readText();
}

export async function writeClipboardText(text: string): Promise<void> {
  return writeText(text);
}

export interface ClipboardImage {
  rgba: Uint8Array;
  width: number;
  height: number;
}

// AD-14: one clipboard service, all clipboard access goes through this file. `readImage()`
// returns already-decoded raw RGBA pixels (row-major, top-to-bottom), not compressed bytes —
// there is no compressed-bytes accessor on the returned `Image` (confirmed against the installed
// `@tauri-apps/plugin-clipboard-manager`/`@tauri-apps/api` type declarations, Story 4.2).
export async function readClipboardImage(): Promise<ClipboardImage> {
  const image = await readImage();
  const [rgba, size] = await Promise.all([image.rgba(), image.size()]);
  return { rgba, width: size.width, height: size.height };
}

export type ClipboardChangeKind = "text" | "image";

// AC1/AC13: wraps the Rust-side watcher (src-tauri/src/clipboard_watch.rs, clipboard-rs) —
// the payload carries only a classification signal, never clipboard content, so this stays a
// thin listener rather than a second data-reading path. `listen()` itself is async, but this
// function's own signature is synchronous (matching how Task 7's `AppSidebar.vue` uses it —
// call on mount, call the returned function on unmount) — if the caller unmounts before the
// underlying `listen()` promise resolves, `cancelled` makes the real unlisten fire immediately
// once it does, instead of leaking a listener registered after cleanup already ran.
export function onClipboardChange(callback: (kind: ClipboardChangeKind) => void): () => void {
  let cancelled = false;
  let unlisten: (() => void) | undefined;

  void listen<{ kind: ClipboardChangeKind }>("clipboard-changed", (event) => {
    callback(event.payload.kind);
  })
    .then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    })
    .catch((error: unknown) => {
      console.error("clipboard: failed to register clipboard-change listener", error);
    });

  return () => {
    cancelled = true;
    unlisten?.();
  };
}
