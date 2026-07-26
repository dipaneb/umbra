// A plain `T | undefined` return can't distinguish "this call was superseded"
// from "this call legitimately resolved to undefined" — a discriminated result
// keeps those two cases distinguishable for any future consumer.
export type LatestWinsResult<T> = { superseded: false; value: T } | { superseded: true };

// Async responses can arrive out of order (e.g. two rapid Format clicks). This
// tags each call with an ID and, once it resolves/rejects, only lets it reach
// the caller if no newer call has started since — a stale outcome (success or
// error) is silently dropped instead of overwriting a fresher one.
export function createLatestWinsRunner() {
  let latestRequestId = 0;

  return async function runLatestWins<T>(task: () => Promise<T>): Promise<LatestWinsResult<T>> {
    const requestId = ++latestRequestId;
    try {
      const value = await task();
      return requestId === latestRequestId ? { superseded: false, value } : { superseded: true };
    } catch (error) {
      if (requestId === latestRequestId) throw error;
      return { superseded: true }; // stale rejection: discard, don't let it surface as a fresh error
    }
  };
}
