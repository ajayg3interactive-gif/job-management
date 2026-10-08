import { useSyncExternalStore } from 'react';

// True while the media query matches. Where matchMedia does not exist (tests, old browsers)
// it returns `fallback`, so the desktop layout is the default.
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia?.(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    () => window.matchMedia?.(query).matches ?? fallback,
    () => fallback,
  );
}
