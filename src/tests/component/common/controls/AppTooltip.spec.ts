import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppTooltip from '@/components/common/controls/AppTooltip.vue';

const options = {
  props: { text: 'Remove from library' },
  slots: { default: '<button>✕</button>' },
};

/** jsdom does no layout: the placement maths needs a box to work from. */
function stubTriggerRect(
  element: HTMLElement,
  { top = 0, bottom = 0, left = 100, right = 140 } = {},
) {
  element.getBoundingClientRect = () =>
    ({ top, bottom, left, right, width: right - left, height: bottom - top }) as DOMRect;
}

describe('AppTooltip', () => {
  it('stays hidden until interaction', () => {
    const wrapper = mount(AppTooltip, options);

    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
    expect(wrapper.get('button').text()).toBe('✕');
  });

  it('appears on mouse hover and disappears on leave', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('mouseenter');
    expect(wrapper.get('[role="tooltip"]').text()).toBe('Remove from library');

    await wrapper.trigger('mouseleave');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });

  it('says nothing for a control that is turned off', async () => {
    const wrapper = mount(AppTooltip, { ...options, props: { ...options.props, disabled: true } });

    await wrapper.trigger('mouseenter');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);

    await wrapper.trigger('focusin');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });

  it('is placed against the window, so no panel can clip it', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('mouseenter');
    await wrapper.vm.$nextTick();

    const style = wrapper.get('[role="tooltip"]').attributes('style') ?? '';

    expect(style).toContain('top:');
    expect(style).toContain('left:');
  });

  it('flips to the other side when the requested one has no room', async () => {
    const wrapper = mount(AppTooltip, options);

    // A trigger against the top edge leaves nothing above it.
    stubTriggerRect(wrapper.element as HTMLElement, { top: 0, bottom: 24 });

    await wrapper.trigger('mouseenter');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="tooltip"]').attributes('data-placement')).toBe('bottom');
  });

  it('keeps the requested side when it fits', async () => {
    const wrapper = mount(AppTooltip, options);

    stubTriggerRect(wrapper.element as HTMLElement, { top: 300, bottom: 324 });

    await wrapper.trigger('mouseenter');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="tooltip"]').attributes('data-placement')).toBe('top');
  });

  it('never leaves the bubble hanging off the left edge', async () => {
    const wrapper = mount(AppTooltip, options);

    stubTriggerRect(wrapper.element as HTMLElement, {
      top: 300,
      bottom: 324,
      left: -80,
      right: -40,
    });

    await wrapper.trigger('mouseenter');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[role="tooltip"]').attributes('style')).toContain('left: 6px');
  });

  it('disappears while the page moves under it', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('mouseenter');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true);

    window.dispatchEvent(new Event('scroll'));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });

  it('also appears from keyboard, not only mouse', async () => {
    const wrapper = mount(AppTooltip, options);

    await wrapper.trigger('focusin');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(true);

    await wrapper.trigger('focusout');
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
  });
});
