// Mirrors `OcrOutcome` in crates/umbra-core/src/ocr.rs — keep in sync by hand.
export interface OcrOutcome {
  text: string;
  confidence: number | null;
}
