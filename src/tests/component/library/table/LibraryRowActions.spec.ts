import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';

import LibraryRowActions from '@/components/library/table/LibraryRowActions.vue';

const wrappers: VueWrapper[] = [];

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

function mountActions(track = makeTrack()) {
  const wrapper = mount(LibraryRowActions, {
    ...withPinia(),
    props: { track },
    attachTo: document.body,
  });
  wrappers.push(wrapper);

  return wrapper;
}

describe('LibraryRowActions', () => {
  it('opens and closes the menu from the button', async () => {
    const wrapper = mountActions();
    const trigger = wrapper.get('.app_menu_trigger');

    await trigger.trigger('click');
    expect(wrapper.find('[role="menu"]').exists()).toBe(true);
    expect(trigger.attributes('aria-expanded')).toBe('true');

    await trigger.trigger('click');
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('closes the menu with Escape', async () => {
    const wrapper = mountActions();

    await wrapper.get('.app_menu_trigger').trigger('click');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('closes the menu on outside click', async () => {
    const wrapper = mountActions();

    await wrapper.get('.app_menu_trigger').trigger('click');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
  });

  it('emits edit and removal, the only actions a row carries', async () => {
    const track = makeTrack();
    const wrapper = mountActions(track);

    await wrapper.get('.app_menu_trigger').trigger('click');
    // Verifying one file at a time is gone: it runs over the whole library instead.
    expect(wrapper.findAll('.app_menu_item')).toHaveLength(2);

    await wrapper.findAll('.app_menu_item')[0]?.trigger('click');
    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[1]?.trigger('click');

    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('remove')).toEqual([[track]]);
  });

  it('shows short labels and the full phrase for screen readers', async () => {
    const wrapper = mountActions(makeTrack({ title: 'Blue in Green' }));

    await wrapper.get('.app_menu_trigger').trigger('click');
    const items = wrapper.findAll('.app_menu_item');

    expect(items.map((item) => item.get('.app_menu_item_label').text())).toEqual([
      'Modifica',
      'Elimina',
    ]);
    expect(items[0]?.attributes('aria-label')).toBe('Modifica i metadati di «Blue in Green»');
  });

  it('opens the menu from keyboard with ArrowDown', async () => {
    const wrapper = mountActions();

    await wrapper.get('.app_menu_trigger').trigger('keydown', { key: 'ArrowDown' });

    expect(wrapper.find('[role="menu"]').exists()).toBe(true);
  });
});
