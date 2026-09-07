import { computed, ref, type Ref } from 'vue';

/**
 * Rows kept mounted above and below the viewport. Enough of them that a fast wheel or a
 * dragged scrollbar finds the next rows already in the DOM instead of drawing a gap.
 */
export const OVERSCAN_ROWS = 8;

export interface VirtualRange {
  start: number;
  end: number;
  offsetTop: number;
  totalHeight: number;
}

/**
 * Rows to render for the current scroll position. Kept as a pure function so the
 * windowing maths can be tested without a DOM.
 */
export function computeVirtualRange(
  itemCount: number,
  itemHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan = OVERSCAN_ROWS,
): VirtualRange {
  const totalHeight = itemCount * itemHeight;

  if (itemCount === 0 || itemHeight <= 0) {
    return { start: 0, end: 0, offsetTop: 0, totalHeight: Math.max(0, totalHeight) };
  }

  const safeScrollTop = Math.min(Math.max(scrollTop, 0), Math.max(totalHeight - viewportHeight, 0));
  const firstVisible = Math.floor(safeScrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + 1;

  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(itemCount, firstVisible + visibleCount + overscan);

  return { start, end, offsetTop: start * itemHeight, totalHeight };
}

export interface VirtualListOptions {
  itemCount: Ref<number>;
  /** A ref: the row height changes with the text size setting. */
  itemHeight: Ref<number>;
  overscan?: number;
}

function sameRange(left: VirtualRange, right: VirtualRange): boolean {
  return (
    left.start === right.start &&
    left.end === right.end &&
    left.offsetTop === right.offsetTop &&
    left.totalHeight === right.totalHeight
  );
}

export function useVirtualList({ itemCount, itemHeight, overscan }: VirtualListOptions) {
  const scrollTop = ref(0);
  const viewportHeight = ref(0);

  // Scrolling reports every pixel, but the window only moves one row at a time. Holding on
  // to the previous object keeps the identity stable in between, so the rows are rendered
  // again when they actually change instead of on every scroll event.
  let previous: VirtualRange | null = null;

  const range = computed(() => {
    const next = computeVirtualRange(
      itemCount.value,
      itemHeight.value,
      viewportHeight.value,
      scrollTop.value,
      overscan,
    );

    if (previous !== null && sameRange(previous, next)) {
      return previous;
    }

    previous = next;
    return next;
  });

  function onScroll(event: Event) {
    const target = event.target as HTMLElement;
    scrollTop.value = target.scrollTop;
    viewportHeight.value = target.clientHeight;
  }

  function measure(element: HTMLElement | null) {
    viewportHeight.value = element?.clientHeight ?? 0;
  }

  return { range, scrollTop, viewportHeight, onScroll, measure };
}
