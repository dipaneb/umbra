// Mirrors `Algorithm` + `DigestEntry` in crates/umbra-core/src/hash.rs, and
// the `hash.algorithms` ids in src/stores/settings.ts — keep the three in
// sync by hand. The string values are the serde `rename` on each `Algorithm`
// variant.
export type Algorithm = "sha256" | "sha512" | "sha3-256" | "sha3-512" | "md5" | "sha1";

export interface DigestEntry {
  algorithm: Algorithm;
  hex: string;
}
