// Mirrors `TargetFormat` in crates/umbra-core/src/image_convert.rs — keep in sync by hand.
// Lowercase string values match what `commands/image.rs::parse_target_format` accepts over IPC.
export type ImageTargetFormat = "png" | "jpeg" | "webp";
