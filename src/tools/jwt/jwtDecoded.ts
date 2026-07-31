// Mirrors `JwtDecoded` in crates/umbra-core/src/jwt.rs — keep in sync by hand.
export interface JwtDecoded {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  exp: number | null;
  iat: number | null;
  nbf: number | null;
}
