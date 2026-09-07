import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { ICON_GLYPHS } from '@/config/icons';
import { useSettingsStore } from '@/stores/settings';
import { VIEW_MODES } from '@/types/settings';

import LibraryViewToggle from '@/components/library/header/LibraryViewToggle.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('LibraryViewToggle', () => {
  it('offers one button per view, without text', () => {
    const wrapper = mount(LibraryViewToggle, withPinia());
    const buttons = wrapper.findAll('button');

    expect(buttons).toHaveLength(VIEW_MODES.length);
    expect(buttons[0]?.text()).toBe(ICON_GLYPHS.list);
    expect(buttons[1]?.text()).toBe(ICON_GLYPHS.grid);
  });

  it('describes both views to screen readers', () => {
    const wrapper = mount(LibraryViewToggle, withPinia());

    expect(wrapper.get('[data-testid="view-table"]').attributes('aria-label')).toBe('Elenco');
    expect(wrapper.get('[data-testid="view-preview"]').attributes('aria-label')).toBe('Anteprime');
    expect(wrapper.get('legend').text()).toBe('Vista');
  });

  it('marks the active view as pressed', () => {
    const wrapper = mount(LibraryViewToggle, withPinia());

    expect(wrapper.get('[data-testid="view-table"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-testid="view-preview"]').attributes('aria-pressed')).toBe('false');
    expect(wrapper.get('[data-testid="view-table"]').classes()).toContain(
      'library_view_toggle_active',
    );
  });

  it('changes view on click', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setViewMode = vi.spyOn(settings, 'setViewMode');

    const wrapper = mount(LibraryViewToggle, options);
    await wrapper.get('[data-testid="view-table"]').trigger('click');

    expect(setViewMode).toHaveBeenCalledWith('table');
    expect(settings.viewMode).toBe('table');
  });

  it('emits the selected view when it is controlled by the parent', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const setViewMode = vi.spyOn(settings, 'setViewMode');

    const wrapper = mount(LibraryViewToggle, {
      ...options,
      props: { modelValue: 'preview' },
    });
    await wrapper.get('[data-testid="view-table"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['table']]);
    expect(setViewMode).not.toHaveBeenCalled();
  });

  it('reflects the view already saved in preferences', async () => {
    const options = withPinia();
    await useSettingsStore().setViewMode('preview');

    const wrapper = mount(LibraryViewToggle, options);

    expect(wrapper.get('[data-testid="view-preview"]').attributes('aria-pressed')).toBe('true');
  });
});
