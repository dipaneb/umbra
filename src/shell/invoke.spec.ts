import { describe, expect, it } from "vitest";
import { createLatestWinsRunner } from "./invoke";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createLatestWinsRunner", () => {
  it("discards a slower first call's result once a second call has resolved", async () => {
    const runLatestWins = createLatestWinsRunner();
    const first = deferred<string>();
    const second = deferred<string>();

    const firstResult = runLatestWins(() => first.promise);
    const secondResult = runLatestWins(() => second.promise);

    second.resolve("second");
    await expect(secondResult).resolves.toEqual({ superseded: false, value: "second" });

    first.resolve("first");
    await expect(firstResult).resolves.toEqual({ superseded: true });
  });

  it("discards a rejected stale call instead of throwing", async () => {
    const runLatestWins = createLatestWinsRunner();
    const first = deferred<string>();
    const second = deferred<string>();

    const firstResult = runLatestWins(() => first.promise);
    const secondResult = runLatestWins(() => second.promise);

    second.resolve("second");
    await expect(secondResult).resolves.toEqual({ superseded: false, value: "second" });

    first.reject(new Error("stale failure"));
    await expect(firstResult).resolves.toEqual({ superseded: true });
  });

  it("resolves normally when a single call is not superseded", async () => {
    const runLatestWins = createLatestWinsRunner();

    await expect(runLatestWins(() => Promise.resolve("only"))).resolves.toEqual({
      superseded: false,
      value: "only",
    });
  });

  it("rejects normally when a single call is not superseded", async () => {
    const runLatestWins = createLatestWinsRunner();

    await expect(runLatestWins(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });

  it("distinguishes a superseded call from a call that legitimately resolves to undefined", async () => {
    const runLatestWins = createLatestWinsRunner();
    const first = deferred<undefined>();
    const second = deferred<undefined>();

    const firstResult = runLatestWins(() => first.promise);
    const secondResult = runLatestWins(() => second.promise);

    second.resolve(undefined);
    await expect(secondResult).resolves.toEqual({ superseded: false, value: undefined });

    first.resolve(undefined);
    await expect(firstResult).resolves.toEqual({ superseded: true });
  });
});
