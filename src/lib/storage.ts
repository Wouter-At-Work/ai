import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Persisted JSON state in localStorage, shared by every component using the same key. */
export function useStoredState<T>(key: string, fallback: T) {
  const raw = useSyncExternalStore(subscribe, () => read(key));
  const value = useMemo<T>(
    () => (raw === null ? fallback : (JSON.parse(raw) as T)),
    [raw],
  );

  const setValue = useCallback(
    (update: (current: T) => T) => {
      const current = read(key);
      const next = update(current === null ? fallback : (JSON.parse(current) as T));
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      listeners.forEach((listener) => listener());
    },
    [key],
  );

  return [value, setValue] as const;
}
