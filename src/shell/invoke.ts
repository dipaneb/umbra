// Async responses can arrive out of order (e.g. two rapid Format clicks). This
// tags each call with an ID and, once it resolves/rejects, only lets it reach
// the caller if no newer call has started since — a stale outcome (success or
// error) is silently dropped instead of overwriting a fresher one.
export function createLatestWinsRunner() {
  let latestRequestId = 0;

  return async function runLatestWins<T>(task: () => Promise<T>): Promise<T | undefined> {
    const requestId = ++latestRequestId;
    try {
      const result = await task();
      return requestId === latestRequestId ? result : undefined;
    } catch (error) {
      if (requestId === latestRequestId) throw error;
      return undefined; // stale rejection: discard, don't let it surface as a fresh error
    }
  };
}
