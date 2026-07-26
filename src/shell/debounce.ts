export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): Debounced<Args> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Args) => {
    if (handle !== undefined) clearTimeout(handle);
    handle = setTimeout(() => fn(...args), delayMs);
  };
  debounced.cancel = () => {
    if (handle !== undefined) clearTimeout(handle);
    handle = undefined;
  };
  return debounced;
}
