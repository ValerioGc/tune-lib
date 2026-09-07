import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SettingsTabs from '@/components/settings/layout/SettingsTabs.vue';

const tabs = [
  { id: 'language', label: 'Lingua' },
  { id: 'textSize', label: 'Dimensione testo' },
  { id: 'theme', label: 'Tema' },
];

const slots = {
  language: '<p class="pannello">contenuto lingua</p>',
  textSize: '<p class="pannello">contenuto testo</p>',
  theme: '<p class="pannello">contenuto tema</p>',
};

function mountTabs() {
  return mount(SettingsTabs, { props: { tabs }, slots });
}

describe('SettingsTabs', () => {
  it('renders one tab per section', () => {
    const wrapper = mountTabs();

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Lingua',
      'Dimensione testo',
      'Tema',
    ]);
  });

  it('shows only the active tab panel', () => {
    const wrapper = mountTabs();

    expect(wrapper.findAll('[role="tabpanel"]')).toHaveLength(1);
    expect(wrapper.get('.pannello').text()).toBe('contenuto lingua');
  });

  it('starts from the first tab', () => {
    const wrapper = mountTabs();
    const first = wrapper.findAll('[role="tab"]')[0];

    expect(first?.attributes('aria-selected')).toBe('true');
    expect(first?.classes()).toContain('settings_tabs_tab_active');
  });

  it('cambia pannello al click', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');

    expect(wrapper.get('.pannello').text()).toBe('contenuto tema');
    expect(wrapper.findAll('[role="tab"]')[2]?.attributes('aria-selected')).toBe('true');
  });

  it('ties each tab to its own panel', async () => {
    const wrapper = mountTabs();
    const tab = wrapper.findAll('[role="tab"]')[0];
    const panel = wrapper.get('[role="tabpanel"]');

    expect(tab?.attributes('aria-controls')).toBe(panel.attributes('id'));
    expect(panel.attributes('aria-labelledby')).toBe(tab?.attributes('id'));
  });

  it('moves with arrows, wrapping to the top at the end', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.get('.pannello').text()).toBe('contenuto testo');

    await wrapper.findAll('[role="tab"]')[1]?.trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.get('.pannello').text()).toBe('contenuto lingua');

    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.get('.pannello').text()).toBe('contenuto tema');
  });

  it('ignores other keys', async () => {
    const wrapper = mountTabs();

    await wrapper.findAll('[role="tab"]')[0]?.trigger('keydown', { key: 'Enter' });

    expect(wrapper.get('.pannello').text()).toBe('contenuto lingua');
  });

  it('keeps inactive tabs out of the tab order', () => {
    const wrapper = mountTabs();
    const tabButtons = wrapper.findAll('[role="tab"]');

    expect(tabButtons[0]?.attributes('tabindex')).toBe('0');
    expect(tabButtons[1]?.attributes('tabindex')).toBe('-1');
  });
});
