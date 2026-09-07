import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useLibraryStore } from '@/stores/library';

import LibraryEmptyState from '@/components/library/messages/LibraryEmptyState.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryEmptyState', () => {
  it('invites adding tracks when the library is empty', () => {
    const wrapper = mount(LibraryEmptyState, { ...withPinia(), props: { variant: 'empty' } });

    expect(wrapper.get('.app_placeholder_title').text()).toBe('La libreria è vuota');
    expect(wrapper.get('button').text()).toBe('Aggiungi brani');
    expect(wrapper.get('.library_empty_hint').text()).toContain('trascinare');
  });

  it('opens the system dialog from the button', async () => {
    const options = withPinia();
    const pickAndAdd = vi.spyOn(useLibraryStore(), 'pickAndAdd').mockResolvedValue(null);

    const wrapper = mount(LibraryEmptyState, { ...options, props: { variant: 'empty' } });
    await wrapper.get('button').trigger('click');

    expect(pickAndAdd).toHaveBeenCalledTimes(1);
  });

  it('reports search with no results', () => {
    const options = withPinia();
    useLibraryStore().setQuery('metal');

    const wrapper = mount(LibraryEmptyState, { ...options, props: { variant: 'noMatches' } });

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Nessun risultato');
    expect(wrapper.get('.app_placeholder_message').text()).toContain('metal');
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
