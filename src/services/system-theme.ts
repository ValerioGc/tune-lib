import type { ResolvedTheme } from '@/types/settings';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function darkSchemeQuery(): MediaQueryList | null {
  if (globalThis.window === undefined || typeof globalThis.window.matchMedia !== 'function') {
    return null;
  }

  return globalThis.window.matchMedia(DARK_SCHEME_QUERY);
}

export function getSystemTheme(): ResolvedTheme {
  return darkSchemeQuery()?.matches ? 'dark' : 'light';
}

/** Subscribes to system theme changes and returns the unsubscribe function. */
export function watchSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  const query = darkSchemeQuery();

  if (!query?.addEventListener) {
    return () => {};
  }

  const listener = (event: MediaQueryListEvent) => onChange(event.matches ? 'dark' : 'light');
  query.addEventListener('change', listener);

  return () => query.removeEventListener('change', listener);
}
