import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSystemTheme, watchSystemTheme } from '@/services/system-theme';

interface FakeQuery {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

const originalMatchMedia = window.matchMedia;

function stubMatchMedia(query: FakeQuery | null) {
  window.matchMedia = (query === null
    ? undefined
    : () => query) as unknown as typeof window.matchMedia;
}

function createFakeQuery(matches: boolean): FakeQuery {
  return { matches, addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('system-theme', () => {
  it('reports dark theme when the system prefers it', () => {
    stubMatchMedia(createFakeQuery(true));

    expect(getSystemTheme()).toBe('dark');
  });

  it('reports light theme as the default', () => {
    stubMatchMedia(createFakeQuery(false));

    expect(getSystemTheme()).toBe('light');
  });

  it('reports light theme when matchMedia is unavailable', () => {
    stubMatchMedia(null);

    expect(getSystemTheme()).toBe('light');
  });

  it('notifies system theme changes', () => {
    const query = createFakeQuery(false);
    stubMatchMedia(query);
    const onChange = vi.fn();

    watchSystemTheme(onChange);
    const listener = query.addEventListener.mock.calls[0]?.[1] as (event: {
      matches: boolean;
    }) => void;
    listener({ matches: true });

    expect(onChange).toHaveBeenCalledWith('dark');

    listener({ matches: false });
    expect(onChange).toHaveBeenLastCalledWith('light');
  });

  it('removes the listener when unsubscribing', () => {
    const query = createFakeQuery(false);
    stubMatchMedia(query);

    const unsubscribe = watchSystemTheme(vi.fn());
    unsubscribe();

    expect(query.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('returns a no-op function when matchMedia is unavailable', () => {
    stubMatchMedia(null);

    const unsubscribe = watchSystemTheme(vi.fn());

    expect(() => unsubscribe()).not.toThrow();
  });
});
