// Mirrors `TargetFormat` in crates/umbra-core/src/image_convert.rs — keep in sync by hand.
// Lowercase string values match what `commands/image.rs::parse_target_format` accepts over IPC.
// "avif" is an encode target only (AC24) — never offered as a source-format filter.
export type ImageTargetFormat = "png" | "jpeg" | "webp" | "avif";
