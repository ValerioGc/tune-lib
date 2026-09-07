import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, ref } from 'vue';

import { computeVirtualRange, useVirtualList } from '@/composables/useVirtualList';

describe('computeVirtualRange', () => {
  it('renders nothing for an empty list', () => {
    expect(computeVirtualRange(0, 50, 500, 0)).toEqual({
      start: 0,
      end: 0,
      offsetTop: 0,
      totalHeight: 0,
    });
  });

  it('computes the total list height', () => {
    expect(computeVirtualRange(100, 50, 500, 0).totalHeight).toBe(5000);
  });

  it('renders only the visible window plus overscan', () => {
    const range = computeVirtualRange(1000, 50, 500, 0, 2);

    expect(range.start).toBe(0);
    expect(range.end).toBe(13);
  });

  it('moves the window following scroll', () => {
    const range = computeVirtualRange(1000, 50, 500, 2500, 2);

    expect(range.start).toBe(48);
    expect(range.offsetTop).toBe(2400);
    expect(range.end).toBeGreaterThan(50);
  });

  it('does not exceed the end of the list', () => {
    const range = computeVirtualRange(20, 50, 500, 100_000);

    expect(range.end).toBe(20);
    expect(range.start).toBeLessThan(20);
  });

  it('ignores negative scroll', () => {
    expect(computeVirtualRange(100, 50, 500, -300).start).toBe(0);
  });

  it('guards against an invalid row height', () => {
    expect(computeVirtualRange(10, 0, 500, 0).end).toBe(0);
  });
});

describe('useVirtualList', () => {
  const Host = defineComponent({
    setup() {
      const itemCount = ref(100);
      const itemHeight = ref(50);
      return { ...useVirtualList({ itemCount, itemHeight }), itemHeight };
    },
    template: '<div />',
  });

  it('updates the window on scroll', () => {
    const wrapper = mount(Host);
    const element = { scrollTop: 1000, clientHeight: 400 } as HTMLElement;

    wrapper.vm.onScroll({ target: element } as unknown as Event);

    expect(wrapper.vm.scrollTop).toBe(1000);
    expect(wrapper.vm.viewportHeight).toBe(400);
    expect(wrapper.vm.range.start).toBeGreaterThan(0);
  });

  it('measures the container, even when missing', () => {
    const wrapper = mount(Host);

    wrapper.vm.measure({ clientHeight: 320 } as HTMLElement);
    expect(wrapper.vm.viewportHeight).toBe(320);

    wrapper.vm.measure(null);
    expect(wrapper.vm.viewportHeight).toBe(0);
  });

  it('follows a changing row height', async () => {
    const wrapper = mount(Host);
    expect(wrapper.vm.range.totalHeight).toBe(5000);

    wrapper.vm.itemHeight = 70;
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.range.totalHeight).toBe(7000);
  });
});
