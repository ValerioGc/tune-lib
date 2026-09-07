import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import type { MenuItem } from '@/types/menu';

import AppMenu from '@/components/common/controls/AppMenu.vue';

const wrappers: VueWrapper[] = [];

const items: MenuItem[] = [
  { id: 'rename', label: 'Rinomina', icon: 'edit' },
  { id: 'export', label: 'Esporta', icon: 'export', disabled: true },
  { id: 'delete', label: 'Elimina', icon: 'remove', danger: true },
];

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

function mountMenu() {
  const wrapper = mount(AppMenu, {
    ...withPinia(),
    props: { items, label: 'Opzioni' },
    attachTo: document.body,
  });
  wrappers.push(wrapper);

  return wrapper;
}

describe('AppMenu', () => {
  it('keeps the panel closed until opened', () => {
    const wrapper = mountMenu();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    expect(wrapper.get('.app_menu_trigger').attributes('aria-label')).toBe('Opzioni');
  });

  it('emits the chosen item identifier', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[2]?.trigger('click');

    expect(wrapper.emitted('select')).toEqual([['delete']]);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('ignores disabled items', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('click');
    const disabilitata = wrapper.findAll('.app_menu_item')[1];

    expect(disabilitata?.attributes('disabled')).toBeDefined();

    await disabilitata?.trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('moves focus to the first usable item', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.findAll('.app_menu_item')[0]?.element);
  });

  it('closes the menu with Escape and outside click', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);

    await wrapper.get('.app_menu_trigger').trigger('click');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('marks the chosen item in an option group', async () => {
    const wrapper = mount(AppMenu, {
      ...withPinia(),
      props: {
        items: [
          { id: 'lib-1', label: 'Main', checked: true },
          { id: 'lib-2', label: 'Jazz', checked: false },
          { id: 'delete', label: 'Elimina', divider: true, danger: true },
        ],
        label: 'Opzioni',
      },
      attachTo: document.body,
    });
    wrappers.push(wrapper);

    await wrapper.get('.app_menu_trigger').trigger('click');
    const items = wrapper.findAll('.app_menu_item');

    expect(items[0]?.attributes('role')).toBe('menuitemradio');
    expect(items[0]?.attributes('aria-checked')).toBe('true');
    expect(items[2]?.attributes('role')).toBe('menuitem');
    expect(wrapper.findAll('.app_menu_divider')).toHaveLength(1);
  });

  it('opens the menu with ArrowDown', async () => {
    const wrapper = mountMenu();

    await wrapper.get('.app_menu_trigger').trigger('keydown', { key: 'ArrowDown' });

    expect(wrapper.find('[role="menu"]').exists()).toBe(true);
  });
});
