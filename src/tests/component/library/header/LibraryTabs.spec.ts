import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import LibraryTabs from '@/components/library/header/LibraryTabs.vue';

beforeEach(() => {
  resetI18n();
});

const tabs = [
  { id: 'tracks', label: 'Brani' },
  { id: 'artists', label: 'Autori' },
  { id: 'albums', label: 'Album' },
];

function mountTabs(modelValue = 'tracks') {
  return mount(LibraryTabs, {
    ...withPinia(),
    props: { modelValue, tabs, label: 'Sezioni', idBase: 'demo' },
  });
}

describe('LibraryTabs', () => {
  it('renders the tabs it was given', () => {
    const wrapper = mountTabs();

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Brani',
      'Autori',
      'Album',
    ]);
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Sezioni');
  });

  it('marks the selected tab and keeps it the only one reachable by tab key', () => {
    const wrapper = mountTabs('albums');
    const items = wrapper.findAll('[role="tab"]');

    expect(items[2]?.classes()).toContain('library_tabs_tab_active');
    expect(items[2]?.attributes('aria-selected')).toBe('true');
    expect(items[2]?.attributes('tabindex')).toBe('0');
    expect(items[0]?.attributes('tabindex')).toBe('-1');
  });

  it('ties each tab to its panel through the id base', () => {
    const tab = mountTabs().findAll('[role="tab"]')[1];

    expect(tab?.attributes('id')).toBe('demo-tab-artists');
    expect(tab?.attributes('aria-controls')).toBe('demo-panel-artists');
  });

  it('reports the tab that was clicked', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');

    expect(wrapper.emitted('update:modelValue')).toEqual([['albums']]);
  });

  it('moves with the arrow keys and wraps around at the ends', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'ArrowRight' });
    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'ArrowLeft' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['artists'], ['albums']]);
  });

  it('jumps to the first and the last tab', async () => {
    const wrapper = mountTabs('artists');

    await wrapper.findAll('[role="tab"]')[1]?.trigger('keydown', { key: 'End' });
    await wrapper.findAll('[role="tab"]')[1]?.trigger('keydown', { key: 'Home' });

    expect(wrapper.emitted('update:modelValue')).toEqual([['albums'], ['tracks']]);
  });

  it('leaves the other keys alone', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'a' });

    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('hides the indicator until the tabs can be measured', () => {
    // jsdom has no layout: with every width at zero the bar has nowhere to go.
    expect(mountTabs().get('.library_tabs_indicator').isVisible()).toBe(false);
  });
});
