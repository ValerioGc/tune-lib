import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack, makeTracks } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import LibraryCounts from '@/components/library/header/LibraryCounts.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryCounts', () => {
  it('counts tracks in the library', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.tracks = makeTracks(3);

    const wrapper = mount(LibraryCounts, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="track-count"]').text()).toBe('3 brani');
  });

  it('uses singular for one track', async () => {
    const options = withPinia();
    useLibraryStore().tracks = makeTracks(1);

    const wrapper = mount(LibraryCounts, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="track-count"]').text()).toBe('1 brano');
  });

  it('reports missing files', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.tracks = [
      ...makeTracks(1),
      ...makeTracks(1).map((track) => ({ ...track, missing: true })),
    ];

    const wrapper = mount(LibraryCounts, options);
    await wrapper.vm.$nextTick();

    const flag = wrapper.get('[data-testid="missing-count"]');

    // Filled in the warning colour: a figure that asks to be acted on, not one more count.
    expect(flag.text()).toContain('1 file non trovato');
    expect(flag.classes()).toContain('library_counts_flag_warning');
    expect(flag.get('.app_icon').classes()).toContain('app_icon_warning');
  });

  it('counts what the open tab is about, and nothing else', async () => {
    const options = withPinia();
    const library = useLibraryStore();
    library.tracks = [
      makeTrack({ artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ artist: 'Artist B', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ artist: 'Artist B', album: 'Album B', genre: null }),
    ];
    const wrapper = mount(LibraryCounts, options);

    expect(wrapper.get('[data-testid="track-count"]').text()).toBe('3 brani');
    expect(wrapper.find('[data-testid="album-count"]').exists()).toBe(false);

    await wrapper.setProps({ tab: 'artists' });
    expect(wrapper.get('[data-testid="artist-count"]').text()).toBe('2 autori');
    expect(wrapper.find('[data-testid="track-count"]').exists()).toBe(false);

    await wrapper.setProps({ tab: 'albums' });
    expect(wrapper.get('[data-testid="album-count"]').text()).toBe('2 album');

    // A genre gathers the others, so it says how many it holds as well. The blank genre is
    // not one of its own.
    await wrapper.setProps({ tab: 'genres' });
    expect(wrapper.findAll('.library_counts span').map((count) => count.text())).toEqual([
      '1 genere',
      '2 autori',
      '2 album',
    ]);
  });

  it('shows the active missing information filter', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.setMissingInfoFilter('artist');

    const wrapper = mount(LibraryCounts, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="missing-info-active"]').text()).toContain('Mancanti: Autore');
  });
});
