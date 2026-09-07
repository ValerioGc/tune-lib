import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { ICON_GLYPHS } from '@/config/icons';

import AppIcon from '@/components/common/AppIcon.vue';

describe('AppIcon', () => {
  it('renders the glyph for the requested name', () => {
    const wrapper = mount(AppIcon, { props: { name: 'remove' } });

    expect(wrapper.text()).toBe(ICON_GLYPHS.remove);
  });

  it('stays decorative without a label', () => {
    const wrapper = mount(AppIcon, { props: { name: 'note' } });

    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('role')).toBeUndefined();
    expect(wrapper.attributes('aria-label')).toBeUndefined();
  });

  it('becomes an announced image when it receives a label', () => {
    const wrapper = mount(AppIcon, { props: { name: 'note', label: 'No cover' } });

    expect(wrapper.attributes('role')).toBe('img');
    expect(wrapper.attributes('aria-label')).toBe('No cover');
    expect(wrapper.attributes('aria-hidden')).toBeUndefined();
  });

  it('exposes a class for each icon', () => {
    const wrapper = mount(AppIcon, { props: { name: 'sortAsc' } });

    expect(wrapper.classes()).toContain('app_icon_sortAsc');
  });
});
