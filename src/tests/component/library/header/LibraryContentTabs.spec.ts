import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import type { LibraryContentTab } from '@/types/library';

import LibraryContentTabs from '@/components/library/header/LibraryContentTabs.vue';

beforeEach(() => {
  resetI18n();
});

function mountTabs(modelValue: LibraryContentTab = 'tracks') {
  return mount(LibraryContentTabs, { ...withPinia(), props: { modelValue } });
}

describe('LibraryContentTabs', () => {
  it('renders library sections', () => {
    const wrapper = mountTabs();

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Brani',
      'Autori',
      'Album',
      'Generi',
    ]);
  });

  it('marks the active tab', () => {
    const wrapper = mountTabs('albums');

    expect(wrapper.findAll('[role="tab"]')[2]?.attributes('aria-selected')).toBe('true');
    expect(wrapper.findAll('[role="tab"]')[2]?.classes()).toContain('library_tabs_tab_active');
  });

  it('emits section changes', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['artists']]);
  });

  it('ties each tab to the panel of the library view', () => {
    const wrapper = mountTabs();
    const tab = wrapper.findAll('[role="tab"]')[0];

    expect(tab?.attributes('id')).toBe('library-tab-tracks');
    expect(tab?.attributes('aria-controls')).toBe('library-panel-tracks');
  });
});
