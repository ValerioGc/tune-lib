import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import PlayingBubble from '@/components/library/PlayingBubble.vue';

beforeEach(() => {
  resetI18n();
});

describe('PlayingBubble', () => {
  it('carries the play symbol', () => {
    const wrapper = mount(PlayingBubble, withPinia());

    expect(wrapper.get('.app_icon').classes()).toContain('app_icon_play');
  });

  it('says what it means, to the pointer and to a screen reader', () => {
    const wrapper = mount(PlayingBubble, withPinia());

    expect(wrapper.attributes('title')).toBe('In riproduzione');
    expect(wrapper.get('.app_icon').attributes('aria-label')).toBe('In riproduzione');
    expect(wrapper.get('.app_icon').attributes('aria-hidden')).toBeUndefined();
  });

  it('follows the language', async () => {
    const wrapper = mount(PlayingBubble, withPinia());
    const { i18n } = await import('@/i18n');
    i18n.global.locale.value = 'en';
    await wrapper.vm.$nextTick();

    expect(wrapper.attributes('title')).toBe('Now playing');
  });
});
