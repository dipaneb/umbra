import type { ToolRegistryEntry } from "../stores/registry";

function rank(tool: ToolRegistryEntry, query: string): number | null {
  const name = tool.name.toLowerCase();
  const aliases = tool.aliases.map((alias) => alias.toLowerCase());

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

  const normalized = trimmed.toLowerCase();

  return tools
    .map((tool) => ({ tool, rank: rank(tool, normalized) }))
    .filter(
      (entry): entry is { tool: ToolRegistryEntry; rank: number } =>
        entry.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.tool);
}
