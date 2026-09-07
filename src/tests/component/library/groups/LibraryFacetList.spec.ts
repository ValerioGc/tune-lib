import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';

import LibraryFacetList from '@/components/library/groups/LibraryFacetList.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryFacetList', () => {
  it('groups tracks by artist with count and duration in list view', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'table',
        tracks: [
          makeTrack({ title: 'Uno', artist: 'Artist B', album: 'Album B', durationMs: 120_000 }),
          makeTrack({ title: 'Due', artist: 'Artist A', album: 'Album A', durationMs: 60_000 }),
          makeTrack({ title: 'Tre', artist: 'Artist B', album: 'Album C', durationMs: 180_000 }),
        ],
      },
    });

    const rows = wrapper.findAll('.library_facet_list_body .library_facet_list_row');

    expect(rows).toHaveLength(2);
    // The column in use also renders its sort arrow.
    expect(
      wrapper
        .findAll('.library_facet_list_heading')
        .map((heading) => heading.text().replace(/[▲▼]/u, '')),
    ).toEqual(['Autore', 'Album', 'Brani', 'Durata']);
    expect(rows[0]?.text()).toContain('Artist A');
    expect(rows[0]?.text()).toContain('1 album');
    expect(rows[0]?.text()).toContain('1 brano');
    expect(rows[0]?.text()).toContain('1:00');
    expect(rows[1]?.text()).toContain('Artist B');
    expect(rows[1]?.text()).toContain('2 album');
    expect(rows[1]?.text()).toContain('2 brani');
    expect(rows[1]?.text()).toContain('5:00');
    expect(rows[1]?.text()).not.toContain('Uno, Tre');
  });

  it('sorts the list from any of its columns, duration included', async () => {
    const tracks = [
      makeTrack({ title: 'Uno', artist: 'Artist A', album: 'Album A', durationMs: 60_000 }),
      makeTrack({ title: 'Due', artist: 'Artist B', album: 'Album B', durationMs: 200_000 }),
      makeTrack({ title: 'Tre', artist: 'Artist B', album: 'Album C', durationMs: 100_000 }),
    ];

    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: { field: 'artist', viewMode: 'table', tracks },
    });
    const names = () =>
      wrapper
        .findAll('.library_facet_list_body .library_facet_list_name_text')
        .map((name) => name.text());

    expect(names()).toEqual(['Artist A', 'Artist B']);

    await wrapper.get('[data-testid="facet-sort-duration"]').trigger('click');
    expect(names()).toEqual(['Artist A', 'Artist B']);

    // A second click on the same column turns the order around.
    await wrapper.get('[data-testid="facet-sort-duration"]').trigger('click');
    expect(names()).toEqual(['Artist B', 'Artist A']);
    expect(wrapper.findAll('.library_facet_list_heading').at(-1)?.attributes('aria-sort')).toBe(
      'descending',
    );

    await wrapper.get('[data-testid="facet-sort-albums"]').trigger('click');
    expect(names()).toEqual(['Artist A', 'Artist B']);
  });

  it('counts the artists of a genre, in the list and on the card', () => {
    const tracks = [
      makeTrack({ title: 'Uno', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Due', artist: 'Artist B', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Tre', artist: 'Artist B', album: 'Album B', genre: 'Jazz' }),
      makeTrack({ title: 'Quattro', artist: 'Artist C', album: 'Album C', genre: 'Rock' }),
    ];

    const list = mount(LibraryFacetList, {
      ...withPinia(),
      props: { field: 'genre', viewMode: 'table', tracks },
    });

    expect(
      list
        .findAll('.library_facet_list_heading')
        .map((heading) => heading.text().replace(/[▲▼]/u, '')),
    ).toEqual(['Genere', 'Autori', 'Album', 'Brani', 'Durata']);

    const rows = list.findAll('.library_facet_list_body .library_facet_list_row');
    expect(rows[0]?.text()).toContain('2 autori');
    expect(rows[0]?.text()).toContain('2 album');
    expect(rows[1]?.text()).toContain('1 autore');

    const cards = mount(LibraryFacetList, {
      ...withPinia(),
      props: { field: 'genre', viewMode: 'preview', tracks },
    }).findAll('.library_facet_card');

    expect(cards[0]?.text()).toContain('2 autori');
    expect(cards[0]?.text()).toContain('2 album');
  });

  it('leaves the artist count out of the artist and album groups', () => {
    const tracks = [makeTrack({ artist: 'Artist A', album: 'Album A', genre: 'Jazz' })];

    for (const field of ['artist', 'album'] as const) {
      const wrapper = mount(LibraryFacetList, {
        ...withPinia(),
        props: { field, viewMode: 'table', tracks },
      });

      expect(
        wrapper.findAll('.library_facet_list_heading').map((heading) => heading.text()),
      ).not.toContain('Autori');
    }
  });

  it('shows groups as preview cards', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'album',
        viewMode: 'preview',
        tracks: [
          makeTrack({ title: 'Blue', album: 'Kind of Blue', durationMs: 60_000 }),
          makeTrack({ title: 'Green', album: 'Kind of Blue', durationMs: 120_000 }),
        ],
      },
    });

    expect(wrapper.find('.library_facet_list').exists()).toBe(false);
    expect(wrapper.findAll('.library_facet_card')).toHaveLength(1);
    expect(wrapper.find('.library_facet_card_label').exists()).toBe(false);
    expect(wrapper.find('.library_facet_card_cover.cover_image').exists()).toBe(true);
    expect(wrapper.get('.library_facet_card_title').text()).toBe('Kind of Blue');
    expect(wrapper.get('.library_facet_card').text()).toContain('2 brani');
    expect(wrapper.text()).not.toContain('Blue, Green');
  });

  it('uses wider and shorter preview cards for genres', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'genre',
        viewMode: 'preview',
        tracks: [
          makeTrack({ genre: 'Jazz', album: 'Album A', hasCover: true }),
          makeTrack({ genre: 'Jazz', album: 'Album B' }),
        ],
      },
    });

    const card = wrapper.get('.library_facet_card');

    expect(card.classes()).toContain('library_facet_card_genre');
    expect(wrapper.find('.library_facet_card_label').exists()).toBe(false);
    expect(wrapper.find('.library_facet_card_cover_mosaic').exists()).toBe(true);
    expect(card.text()).toContain('2 album');
    expect(card.text()).toContain('2 brani');
  });

  it('marks only the playing genre card, with a bubble on its corner', () => {
    const playingTrack = makeTrack({ genre: 'Jazz', album: 'Album A', hasCover: true });
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'genre',
        viewMode: 'preview',
        playingTrack,
        tracks: [playingTrack, makeTrack({ genre: 'Rock', album: 'Album B', hasCover: true })],
      },
    });

    const cards = wrapper.findAll('.library_facet_card_genre');

    expect(cards).toHaveLength(2);
    expect(cards[0]?.get('[data-testid="playing-bubble"]').attributes('title')).toBe(
      'In riproduzione',
    );
    // The state no longer costs the body a line, so nothing has to be reserved for it.
    expect(cards[0]?.text()).not.toContain('In riproduzione');
    expect(cards[1]?.find('[data-testid="playing-bubble"]').exists()).toBe(false);
  });

  it('shows a cover mosaic for artist previews without repeating the field label', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'preview',
        tracks: [
          makeTrack({ artist: 'Artist A', album: 'Album A', hasCover: true }),
          makeTrack({ artist: 'Artist A', album: 'Album B' }),
        ],
      },
    });

    expect(wrapper.get('.library_facet_card').classes()).toContain('library_facet_card_artist');
    expect(wrapper.find('.library_facet_card_label').exists()).toBe(false);
    expect(wrapper.find('.library_facet_card_cover_mosaic').exists()).toBe(true);
    expect(wrapper.get('.library_facet_card').text()).toContain('2 album');
  });

  it('shows the artist on album groups', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'album',
        viewMode: 'preview',
        tracks: [
          makeTrack({ artist: 'Miles Davis', album: 'Kind of Blue' }),
          makeTrack({ artist: 'Miles Davis', album: 'Kind of Blue' }),
        ],
      },
    });

    // Named, not labelled: the card has room for the name of the artist and nothing else.
    expect(wrapper.text()).toContain('Miles Davis');
  });

  it('marks the album card that contains the playing track', () => {
    const playingTrack = makeTrack({
      title: 'Blue',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      durationMs: 60_000,
    });
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'album',
        viewMode: 'preview',
        playingTrack,
        tracks: [
          playingTrack,
          makeTrack({ title: 'Green', artist: 'Miles Davis', album: 'Kind of Blue' }),
          makeTrack({ title: 'Other', artist: 'Other Artist', album: 'Other Album' }),
        ],
      },
    });

    const playingCards = wrapper.findAll('.library_facet_card_playing');

    expect(playingCards).toHaveLength(1);
    expect(playingCards[0]?.attributes('aria-current')).toBe('true');
    expect(playingCards[0]?.text()).toContain('Kind of Blue');
    expect(playingCards[0]?.get('[data-testid="playing-bubble"]').attributes('title')).toBe(
      'In riproduzione',
    );
  });

  it('shows the playing badge inside the name cell of a list row', () => {
    const playingTrack = makeTrack({ title: 'Blue', artist: 'Miles Davis' });
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'table',
        playingTrack,
        tracks: [playingTrack, makeTrack({ title: 'Other', artist: 'Other Artist' })],
      },
    });

    const rows = wrapper.findAll('.library_facet_list_body .library_facet_list_row');
    const badge = rows[0]?.get('.library_facet_list_name .library_facet_list_badge');

    expect(badge?.text()).toContain('In riproduzione');
    expect(badge?.attributes('title')).toBe('In riproduzione');
    expect(badge?.get('.app_icon').classes()).toContain('app_icon_play');
    expect(rows[1]?.find('.library_facet_list_badge').exists()).toBe(false);
  });

  it('keeps the row on the columns the header declares, badge included', () => {
    const playingTrack = makeTrack({ title: 'Blue', artist: 'Miles Davis' });
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'table',
        playingTrack,
        tracks: [playingTrack],
      },
    });

    // The badge lives in the name cell: as a cell of its own it would add a column.
    expect(wrapper.findAll('.library_facet_list_head th')).toHaveLength(4);
    expect(wrapper.findAll('.library_facet_list_body .library_facet_list_row td')).toHaveLength(4);
  });

  it('marks the album row that contains the playing track', () => {
    const playingTrack = makeTrack({ title: 'Blue', album: 'Kind of Blue' });
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'album',
        viewMode: 'table',
        playingTrack,
        tracks: [
          playingTrack,
          makeTrack({ title: 'Green', album: 'Kind of Blue' }),
          makeTrack({ title: 'Other', album: 'Other Album' }),
        ],
      },
    });

    const playingRows = wrapper.findAll('.library_facet_list_body .library_facet_list_row_playing');

    expect(playingRows).toHaveLength(1);
    expect(playingRows[0]?.attributes('aria-current')).toBe('true');
    expect(playingRows[0]?.text()).toContain('Kind of Blue');
  });

  it('opens the selected group from a card', async () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'preview',
        tracks: [makeTrack({ artist: 'Artist A' })],
      },
    });

    await wrapper.get('.library_facet_card').trigger('click');

    expect(wrapper.emitted('open')).toEqual([
      [{ field: 'artist', key: 'Artist A', name: 'Artist A' }],
    ]);
  });

  it('opens the selected group from a row', async () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'artist',
        viewMode: 'table',
        tracks: [makeTrack({ artist: 'Artist A' })],
      },
    });

    await wrapper.get('.library_facet_list_body .library_facet_list_row').trigger('keydown.enter');

    expect(wrapper.emitted('open')).toEqual([
      [{ field: 'artist', key: 'Artist A', name: 'Artist A' }],
    ]);
  });

  it('puts missing values at the bottom with a readable label', () => {
    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: {
        field: 'genre',
        viewMode: 'table',
        tracks: [makeTrack({ genre: null }), makeTrack({ genre: 'Jazz' })],
      },
    });

    const rows = wrapper.findAll('.library_facet_list_body .library_facet_list_row');

    expect(rows[0]?.text()).toContain('Jazz');
    expect(rows[1]?.text()).toContain('Senza genere');
  });

  it('reports a compilation as various artists, in the cards and in the list', async () => {
    const tracks = ['A', 'B', 'C', 'D'].map((artist, index) =>
      makeTrack({ title: `Track ${index}`, artist, album: 'Compilation' }),
    );

    const preview = mount(LibraryFacetList, {
      ...withPinia(),
      props: { field: 'album', viewMode: 'preview', tracks },
    });

    expect(preview.get('.library_facet_card_meta').text()).toContain('Artisti vari');

    const list = mount(LibraryFacetList, {
      ...withPinia(),
      props: { field: 'album', viewMode: 'table', tracks },
    });

    // The first cell holds the album, the second the artists it gathers.
    expect(list.findAll('.library_facet_list_body .library_facet_list_cell')[1]?.text()).toBe(
      'Artisti vari',
    );
  });

  /**
   * The control that sets this lives in the toolbar at the top of the page now, so what is
   * left to check here is that the cards follow whatever order they are handed.
   */
  it('orders the cards by the sort it is given', async () => {
    const tracks = [
      makeTrack({ title: 'Uno', artist: 'Artist A', album: 'Album A', durationMs: 60_000 }),
      makeTrack({ title: 'Due', artist: 'Artist B', album: 'Album B', durationMs: 200_000 }),
      makeTrack({ title: 'Tre', artist: 'Artist B', album: 'Album C', durationMs: 100_000 }),
    ];

    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: { field: 'artist', viewMode: 'preview', tracks },
    });
    const names = () => wrapper.findAll('.library_facet_card_title').map((title) => title.text());

    expect(names()).toEqual(['Artist A', 'Artist B']);

    await wrapper.setProps({ sort: { column: 'duration', direction: 'desc' } });

    expect(names()).toEqual(['Artist B', 'Artist A']);
  });

  it('sorts on its own where nobody holds the order for it', async () => {
    const tracks = [
      makeTrack({ artist: 'Artist A', durationMs: 60_000 }),
      makeTrack({ artist: 'Artist B', durationMs: 200_000 }),
    ];

    const wrapper = mount(LibraryFacetList, {
      ...withPinia(),
      props: { field: 'artist', viewMode: 'table', tracks },
    });

    await wrapper.get('[data-testid="facet-sort-duration"]').trigger('click');

    expect(wrapper.emitted('update:sort')?.at(-1)).toEqual([
      { column: 'duration', direction: 'asc' },
    ]);
  });
});
