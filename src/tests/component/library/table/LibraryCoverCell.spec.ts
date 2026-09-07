import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import LibraryCoverCell from '@/components/library/table/LibraryCoverCell.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryCoverCell', () => {
  it('shows a placeholder when there is no cover', async () => {
    const wrapper = mount(LibraryCoverCell, {
      ...withPinia(),
      props: { track: makeTrack({ hasCover: false }) },
    });
    await flushPromises();

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('.cover_image_fallback').attributes('aria-label')).toBe('Nessuna copertina');
  });

  it('shows the cover loaded from the store', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    vi.spyOn(store, 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');

    const wrapper = mount(LibraryCoverCell, {
      ...options,
      props: { track: makeTrack({ hasCover: true }) },
    });
    await flushPromises();

    expect(wrapper.get('img').attributes('src')).toBe('cover://localhost/track.mp3?v=0');
  });

  it('asks for the address again when the track changes', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    const coverUrl = vi.spyOn(store, 'coverUrl').mockReturnValue('cover://localhost/a.mp3?v=0');

    const wrapper = mount(LibraryCoverCell, {
      ...options,
      props: { track: makeTrack({ id: 'one' }) },
    });
    coverUrl.mockReturnValue('cover://localhost/b.mp3?v=0');
    await wrapper.setProps({ track: makeTrack({ id: 'two' }) });

    expect(wrapper.get('img').attributes('src')).toBe('cover://localhost/b.mp3?v=0');
  });
});
