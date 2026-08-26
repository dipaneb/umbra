// Builds a JSONPath (RFC 9535) locator from a tree row's segment path — the
// same query language the Query tab evaluates (Story 8.1 Task 2 decision:
// JSONPath over JMESPath, chosen partly *because* it lets a path copied here
// paste directly into Query). An identifier-shaped key uses dot notation; any
// other key (containing `.`, `[`, spaces, or starting with a digit) falls
// back to quoted bracket notation, which RFC 9535 defines for exactly this
// case.
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function jsonPathFromSegments(segments: ReadonlyArray<string | number>): string {
  let path = "$";
  for (const segment of segments) {
    if (typeof segment === "number") {
      path += `[${segment}]`;
    } else if (IDENTIFIER.test(segment)) {
      path += `.${segment}`;
    } else {
      path += `[${JSON.stringify(segment)}]`;
    }
  }
  return path;
}
