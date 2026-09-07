import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, ref } from 'vue';

import { isForeground, useForegroundTimeout, useOverlay } from '@/composables/useForeground';

beforeEach(() => {
  vi.useFakeTimers();
  setWindowVisible(true);
});

afterEach(() => {
  vi.useRealTimers();
});

/** jsdom reports the page as visible and never changes its mind on its own. */
function setWindowVisible(visible: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (visible ? 'visible' : 'hidden'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** A component that counts down, so the composable is used the way a banner uses it. */
function mountCountdown(durationMs = 5000) {
  const elapsed = vi.fn();
  const duration = ref(durationMs);
  // A bare probe rather than a component of the app: what is under test is the composable,
  // and a real banner would bring its store and its markup along for no gain.
  // Kept from the setup rather than read back off the instance, which types it properly.
  let restart = () => {};
  const wrapper = mount({
    setup() {
      const timer = useForegroundTimeout(() => duration.value, elapsed);
      restart = timer.restart;

      return { isCounting: timer.isCounting };
    },
    render: () => h('div'),
  });

  return { wrapper, elapsed, duration, restart: () => restart() };
}

function mountOverlay(active = ref(true)) {
  return {
    active,
    wrapper: mount({
      setup() {
        useOverlay(() => active.value);
      },
      render: () => h('div'),
    }),
  };
}

describe('useForeground', () => {
  it('marks hidden windows so CSS animations pause without affecting audio', () => {
    setWindowVisible(false);
    expect(document.documentElement.dataset.windowHidden).toBe('true');
    setWindowVisible(true);
    expect(document.documentElement.dataset.windowHidden).toBe('false');
  });
  it('counts the delay down while the page is in front of the reader', () => {
    const { wrapper, elapsed } = mountCountdown();

    expect(wrapper.vm.isCounting).toBe(true);

    vi.advanceTimersByTime(5000);

    expect(elapsed).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('holds what is left of the delay while the window is out of sight', async () => {
    const { wrapper, elapsed } = mountCountdown();

    vi.advanceTimersByTime(2000);
    setWindowVisible(false);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isCounting).toBe(false);

    // A minute away from the window costs the delay nothing.
    vi.advanceTimersByTime(60_000);

    expect(elapsed).not.toHaveBeenCalled();

    setWindowVisible(true);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isCounting).toBe(true);

    // The three seconds that were left are the three seconds that remain.
    vi.advanceTimersByTime(2999);

    expect(elapsed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(elapsed).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('stops for a panel opened over the page, and starts again when it closes', async () => {
    const { wrapper, elapsed } = mountCountdown();
    const overlay = mountOverlay();
    await wrapper.vm.$nextTick();

    expect(isForeground.value).toBe(false);
    expect(wrapper.vm.isCounting).toBe(false);

    vi.advanceTimersByTime(60_000);

    expect(elapsed).not.toHaveBeenCalled();

    overlay.active.value = false;
    await wrapper.vm.$nextTick();

    expect(isForeground.value).toBe(true);

    vi.advanceTimersByTime(5000);

    expect(elapsed).toHaveBeenCalledTimes(1);

    overlay.wrapper.unmount();
    wrapper.unmount();
  });

  it('releases the page when a panel is removed rather than closed', async () => {
    const overlay = mountOverlay();
    await overlay.wrapper.vm.$nextTick();

    expect(isForeground.value).toBe(false);

    overlay.wrapper.unmount();

    expect(isForeground.value).toBe(true);
  });

  it('counts two panels apart, so the first to close does not free the page', async () => {
    const first = mountOverlay(ref(true));
    const second = mountOverlay(ref(true));
    await first.wrapper.vm.$nextTick();

    first.active.value = false;
    await first.wrapper.vm.$nextTick();

    expect(isForeground.value).toBe(false);

    second.active.value = false;
    await second.wrapper.vm.$nextTick();

    expect(isForeground.value).toBe(true);

    first.wrapper.unmount();
    second.wrapper.unmount();
  });

  it('never starts a delay of no length', () => {
    const { wrapper, elapsed } = mountCountdown(0);

    expect(wrapper.vm.isCounting).toBe(false);

    vi.advanceTimersByTime(60_000);

    expect(elapsed).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('gives the delay back its full length on a restart', () => {
    const { wrapper, elapsed, restart } = mountCountdown();

    vi.advanceTimersByTime(4000);
    restart();
    vi.advanceTimersByTime(4999);

    expect(elapsed).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(elapsed).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
