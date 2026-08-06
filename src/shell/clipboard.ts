import { readImage, readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

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
