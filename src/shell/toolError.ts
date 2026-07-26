export type ToolErrorPosition =
  | { kind: "LineCol"; line: number; column: number }
  | { kind: "ByteOffset"; offset: number };

export interface ToolError {
  code: string;
  message: string;
  position: ToolErrorPosition | null;
  context: string | null;
}

export function isToolError(value: unknown): value is ToolError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}
