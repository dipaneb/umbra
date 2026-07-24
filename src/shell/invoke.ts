export function createLatestWinsRunner() {
  let latestRequestId = 0;

  return async function runLatestWins<T>(task: () => Promise<T>): Promise<T | undefined> {
    const requestId = ++latestRequestId;
    try {
      const result = await task();
      return requestId === latestRequestId ? result : undefined;
    } catch (error) {
      if (requestId === latestRequestId) throw error;
      return undefined;
    }
  };
}
