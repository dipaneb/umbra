import type { ToolRegistryEntry } from "../stores/registry";

// Strips diacritics (é -> e, ô -> o, ç -> c, …) after lowercasing, so typing
// "cle" matches the French alias "clé" and vice versa — without this, a
// French speaker typing the accent-free version of their own search term
// (common on a non-French keyboard layout, or just habit) would silently
// get zero results. NFD decomposes each accented character into its base
// letter plus a separate combining-mark code point; stripping the Unicode
// "Mark" category then drops just the accent, leaving the base letter.
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function rank(tool: ToolRegistryEntry, query: string): number | null {
  const name = normalize(tool.name);
  const aliases = tool.aliases.map((alias) => normalize(alias));

  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (aliases.some((alias) => alias === query)) return 2;
  if (aliases.some((alias) => alias.startsWith(query))) return 3;
  if (name.includes(query)) return 4;
  if (aliases.some((alias) => alias.includes(query))) return 5;
  return null;
}

export function searchTools(
  tools: ToolRegistryEntry[],
  query: string,
): ToolRegistryEntry[] {
  const trimmed = query.trim();
  if (trimmed === "") return tools;

  const normalized = normalize(trimmed);

  return tools
    .map((tool) => ({ tool, rank: rank(tool, normalized) }))
    .filter(
      (entry): entry is { tool: ToolRegistryEntry; rank: number } =>
        entry.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.tool);
}
