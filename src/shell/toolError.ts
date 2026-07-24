export type ToolErrorPosition =
  | { kind: "LineCol"; line: number; column: number }
  | { kind: "ByteOffset"; offset: number };

export interface ToolError {
  code: string;
  message: string;
  position: ToolErrorPosition | null;
  context: string | null;
}
