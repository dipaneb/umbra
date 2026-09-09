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

  // `task` receives an `isLatest()` predicate (code review 2026-09-08). Discarding a stale
  // RESULT is not enough for a task that publishes something of its own partway through: a task
  // that writes to shared state mid-flight — `DropZone.vue`'s paste path publishes the clipboard
  // pixels as soon as it has read them, so the view can show the image during a ~3 s inference —
  // is ordered by when its own await resolves, not by when it was dispatched, and can therefore
  // land AFTER a newer run has already settled. Passing the check in is what lets such a task
  // decline to write. Callers that publish nothing mid-flight ignore the argument.
  return async function runLatestWins<T>(
    task: (isLatest: () => boolean) => Promise<T>,
  ): Promise<LatestWinsResult<T>> {
    const requestId = ++latestRequestId;
    const isLatest = () => requestId === latestRequestId;
    try {
      const value = await task(isLatest);
      return requestId === latestRequestId ? { superseded: false, value } : { superseded: true };
    } catch (error) {
      if (requestId === latestRequestId) throw error;
      return { superseded: true }; // stale rejection: discard, don't let it surface as a fresh error
    }
  };
}
