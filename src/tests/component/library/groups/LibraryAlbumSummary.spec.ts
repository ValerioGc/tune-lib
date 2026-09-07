import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';

import LibraryAlbumSummary from '@/components/library/groups/LibraryAlbumSummary.vue';

beforeEach(() => {
  resetI18n();
});

function mountSummary(props: Partial<InstanceType<typeof LibraryAlbumSummary>['$props']> = {}) {
  return mount(LibraryAlbumSummary, {
    ...withPinia(),
    props: {
      name: 'Adversus',
      coverTrack: makeTrack({ hasCover: true }),
      year: 2018,
      artists: [{ key: 'Colle Der Fomento', name: 'Colle Der Fomento' }],
      genres: [{ key: 'Hip Hop/Rap Italiano', name: 'Hip Hop/Rap Italiano' }],
      trackCount: 1,
      ...props,
    },
  });
}

describe('LibraryAlbumSummary', () => {
  it('reads as cover, title, year, artist and genre', () => {
    const wrapper = mountSummary();

    expect(wrapper.find('.library_album_summary_cover').exists()).toBe(true);
    expect(wrapper.get('.library_album_summary_name').text()).toBe('Adversus');
    expect(wrapper.get('.library_album_summary_year').text()).toBe('2018');
    expect(wrapper.get('.library_album_summary_artists').text()).toBe('Colle Der Fomento');
    expect(wrapper.get('.library_album_summary_genres').text()).toBe('Hip Hop/Rap Italiano');
    expect(wrapper.get('.library_album_summary_count').text()).toBe('1 brano');
  });

  it('carries no label in front of the fields', () => {
    expect(mountSummary().text()).not.toMatch(/Autore:|Genere:/);
  });

  it('joins several artists and several genres', () => {
    const wrapper = mountSummary({
      artists: [
        { key: 'Artist A', name: 'Artist A' },
        { key: 'Artist B', name: 'Artist B' },
      ],
      genres: [
        { key: 'Jazz', name: 'Jazz' },
        { key: 'Fusion', name: 'Fusion' },
      ],
    });

    expect(
      wrapper
        .findAll('.library_album_summary_artists .library_album_summary_link')
        .map((link) => link.text()),
    ).toEqual(['Artist A', 'Artist B']);
    expect(
      wrapper
        .findAll('.library_album_summary_genres .library_album_summary_link')
        .map((link) => link.text()),
    ).toEqual(['Jazz', 'Fusion']);
  });

  it('opens the artist and the genre it was asked for, by key', async () => {
    const wrapper = mountSummary({
      artists: [{ key: '__unknown__', name: 'Senza autore' }],
      genres: [{ key: 'Jazz', name: 'Jazz' }],
    });

    await wrapper
      .get('.library_album_summary_artists .library_album_summary_link')
      .trigger('click');
    await wrapper.get('.library_album_summary_genres .library_album_summary_link').trigger('click');

    expect(wrapper.emitted('openArtist')).toEqual([['__unknown__']]);
    expect(wrapper.emitted('openGenre')).toEqual([['Jazz']]);
  });

  it('drops the lines it has nothing to put on', () => {
    const wrapper = mountSummary({ coverTrack: null, year: null, artists: [], genres: [] });

    expect(wrapper.find('.library_album_summary_cover').exists()).toBe(false);
    expect(wrapper.find('.library_album_summary_year').exists()).toBe(false);
    expect(wrapper.find('.library_album_summary_artists').exists()).toBe(false);
    expect(wrapper.find('.library_album_summary_genres').exists()).toBe(false);
    expect(wrapper.get('.library_album_summary_name').text()).toBe('Adversus');
  });

  it('says the artists are various past a handful, and still names every genre', () => {
    const wrapper = mountSummary({
      artists: ['A', 'B', 'C', 'D'].map((name) => ({ key: name, name })),
      genres: ['Jazz', 'Fusion', 'Rock', 'Soul'].map((name) => ({ key: name, name })),
    });

    expect(wrapper.get('[data-testid="album-various-artists"]').text()).toBe('Artisti vari');
    expect(
      wrapper.findAll('.library_album_summary_artists .library_album_summary_link'),
    ).toHaveLength(0);
    expect(
      wrapper
        .findAll('.library_album_summary_genres .library_album_summary_link')
        .map((link) => link.text()),
    ).toEqual(['Jazz', 'Fusion', 'Rock', 'Soul']);
  });

  it('still names three artists, one link each', () => {
    const wrapper = mountSummary({
      artists: ['A', 'B', 'C'].map((name) => ({ key: name, name })),
    });

    expect(wrapper.find('[data-testid="album-various-artists"]').exists()).toBe(false);
    expect(
      wrapper.findAll('.library_album_summary_artists .library_album_summary_link'),
    ).toHaveLength(3);
  });
});
