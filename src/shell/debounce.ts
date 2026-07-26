export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  let handle: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (handle !== undefined) clearTimeout(handle);
    handle = setTimeout(() => fn(...args), delayMs);
  };
}
