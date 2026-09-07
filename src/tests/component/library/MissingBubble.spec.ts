import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import MissingBubble from '@/components/library/MissingBubble.vue';

beforeEach(() => {
  resetI18n();
});

describe('MissingBubble', () => {
  it('carries the alert symbol', () => {
    const wrapper = mount(MissingBubble, withPinia());

    expect(wrapper.get('.app_icon').classes()).toContain('app_icon_warning');
  });

  it('says what it means, to the pointer and to a screen reader', () => {
    const wrapper = mount(MissingBubble, withPinia());

    expect(wrapper.attributes('title')).toBe('File non più presente su disco');
    expect(wrapper.get('.app_icon').attributes('aria-label')).toBe(
      'File non più presente su disco',
    );
  });

  it('follows the language', async () => {
    const wrapper = mount(MissingBubble, withPinia());
    const { i18n } = await import('@/i18n');
    i18n.global.locale.value = 'en';
    await wrapper.vm.$nextTick();

    expect(wrapper.attributes('title')).toBe('File no longer on disk');
  });
});
