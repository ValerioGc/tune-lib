import { config } from '@vue/test-utils';

config.global.stubs = {
  teleport: true,
};

// jsdom has no matchMedia, which the system theme detection relies on.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom has no IntersectionObserver: the stub reports the element as visible at once,
// so lazily loaded covers behave like eager ones in tests.
const scope = globalThis as unknown as Record<string, unknown>;

if (scope.IntersectionObserver === undefined) {
  type Entry = { isIntersecting: boolean; target: Element };

  class ImmediateIntersectionObserver {
    constructor(private readonly callback: (entries: Entry[]) => void) {}

    observe(target: Element) {
      this.callback([{ isIntersecting: true, target }]);
    }

    unobserve() {}
    disconnect() {}

    takeRecords(): Entry[] {
      return [];
    }
  }

  scope.IntersectionObserver = ImmediateIntersectionObserver;
}
