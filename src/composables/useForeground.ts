import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';

/**
 * Whether the page is in front of the person using it.
 *
 * Two things can take it away: the window itself going out of sight — minimised, sent to
 * the tray, or covered whole by another application — and a panel of the app opening over
 * the page. Anything counted down on screen has to stop for both, or it runs out while
 * nobody is in a position to read it.
 */

/** How many panels are currently covering the page. */
const overlays = ref(0);
export const isWindowVisible = ref(true);

function readVisibility() {
  isWindowVisible.value = document.visibilityState !== 'hidden';
  document.documentElement.dataset.windowHidden = String(!isWindowVisible.value);
}

// One listener for the window, attached when the module is first pulled in and never taken
// down: the answer is wanted for as long as the window is open, and keeping a count of who
// is still interested would cost more than the listener does.
if (typeof document !== 'undefined') {
  readVisibility();
  document.addEventListener('visibilitychange', readVisibility);
}

export const isForeground = computed(() => isWindowVisible.value && overlays.value === 0);

/**
 * Declares that this component covers the page while `isActive` says so.
 *
 * The count is released on unmount as well, since a panel is usually removed rather than
 * closed — a modal behind a `v-if`, the full player leaving the screen.
 */
export function useOverlay(isActive: () => boolean): void {
  let counted = false;

  function set(active: boolean) {
    if (active === counted) {
      return;
    }

    counted = active;
    overlays.value += active ? 1 : -1;
  }

  watch(isActive, set, { immediate: true });
  onBeforeUnmount(() => set(false));
}

/**
 * A delay that only elapses while the page is in front of the reader.
 *
 * What is left of it is kept, so a window put away and brought back carries on from where
 * it stopped rather than starting over — and a banner covered for a minute is still there
 * when the panel over it closes.
 *
 * `duration` of zero means no timer at all: the caller waits to be told by hand.
 */
export function useForegroundTimeout(
  duration: () => number,
  run: () => void,
): { isCounting: Ref<boolean>; restart: () => void } {
  const isCounting = ref(false);
  const remaining = ref(duration());
  let handle: ReturnType<typeof setTimeout> | null = null;
  let startedAt = 0;

  function pause() {
    if (handle === null) {
      return;
    }

    clearTimeout(handle);
    handle = null;
    isCounting.value = false;
    remaining.value = Math.max(0, remaining.value - (Date.now() - startedAt));
  }

  function resume() {
    if (handle !== null || remaining.value <= 0 || !isForeground.value) {
      return;
    }

    startedAt = Date.now();
    isCounting.value = true;
    handle = setTimeout(() => {
      handle = null;
      isCounting.value = false;
      remaining.value = 0;
      run();
    }, remaining.value);
  }

  function restart() {
    pause();
    remaining.value = duration();
    resume();
  }

  watch(isForeground, (foreground) => (foreground ? resume() : pause()));
  onMounted(restart);
  onBeforeUnmount(pause);

  return { isCounting, restart };
}
