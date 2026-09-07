import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack, makeTracks } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

import LibraryView from '@/views/LibraryView.vue';
import MetadataEditor from '@/components/metadata/MetadataEditor.vue';
import CoverPicker from '@/components/metadata/fields/CoverPicker.vue';

const drop = vi.hoisted(() => ({ onDrop: null as ((paths: string[]) => void) | null }));

vi.mock('@/composables/useFileDrop', async () => {
  const { ref: reactiveRef } = await import('vue');

  return {
    useFileDrop: (onDrop: (paths: string[]) => void) => {
      drop.onDrop = onDrop;
      return { isDraggingOver: reactiveRef(false), handle: () => {} };
    },
  };
});

beforeEach(() => {
  resetI18n();
});

/**
 * Stands in for the read of the library.
 *
 * What the view waits for is not the request but the answer, so a stub of the read has to
 * leave the store the way an answer leaves it: read once, whatever it found.
 */
function readLibrary(store: ReturnType<typeof useLibraryStore>) {
  return async () => {
    store.isReady = true;
  };
}

async function mountView() {
  const options = withPinia();
  const store = useLibraryStore();
  const load = vi.spyOn(store, 'loadHomeLibrary').mockImplementation(readLibrary(store));

  const wrapper = mount(LibraryView, options);
  await flushPromises();

  return { wrapper, store, load };
}

describe('LibraryView', () => {
  it.each(['tracks', 'artists', 'albums', 'genres'])(
    'offers the album cover change after saving from the %s tab',
    async (tab) => {
      const { wrapper, store } = await mountView();
      const track = makeTrack({ id: 'current', title: 'Visible', album: 'Album' });
      const sibling = makeTrack({ id: 'sibling', title: 'Hidden', album: ' album ' });
      store.tracks = [track, sibling];
      vi.spyOn(store, 'heavyCoverBytes').mockResolvedValue(null);
      vi.spyOn(store, 'saveMetadata').mockImplementation(async () => {
        const updated = { ...track };
        store.tracks = [updated, sibling];
        await flushPromises();
        return updated;
      });
      const saveCover = vi.spyOn(store, 'saveCover').mockResolvedValue(track);
      await flushPromises();
      await wrapper.get(`#library-tab-${tab}`).trigger('click');
      store.query = 'Visible';
      store.editingId = track.id;
      await flushPromises();
      const editor = wrapper.findComponent(MetadataEditor);
      const cover = { mimeType: 'image/png', data: 'AAA' };
      editor.findComponent(CoverPicker).vm.$emit('select', cover);
      await editor.get('[data-testid="metadata-save"]').trigger('click');
      await flushPromises();
      expect(saveCover).not.toHaveBeenCalled();
      await editor.get('[data-testid="cover-batch-confirm"]').trigger('click');
      await flushPromises();
      expect(saveCover).toHaveBeenCalledWith(track.id, cover);
      expect(saveCover).toHaveBeenCalledWith(sibling.id, cover);
      expect(store.editingId).toBeNull();
    },
  );

  it('shows import progress centrally through saving and refreshing', async () => {
    const { wrapper, store } = await mountView();
    store.isImporting = true;
    store.importProgress = { done: 5, total: 10 };
    await flushPromises();
    expect(wrapper.get('[data-testid="library-import-progress"]').text()).toContain('40%');
    expect(wrapper.find('.library_empty_actions').exists()).toBe(false);
    expect(wrapper.get('.library_import_button').text()).not.toContain('%');
    store.importProgress = { done: 10, total: 10, finalizing: true };
    await flushPromises();
    expect(wrapper.get('[data-testid="library-import-progress"]').text()).toContain('90%');
    store.isImportRefreshing = true;
    store.tracks = makeTracks(2);
    await flushPromises();
    expect(wrapper.get('[data-testid="library-import-progress"]').text()).toContain('95%');
    expect(wrapper.find('.library_table').exists()).toBe(false);
    store.isImporting = false;
    await flushPromises();
    expect(wrapper.find('[data-testid="library-import-progress"]').exists()).toBe(false);
    expect(wrapper.find('.library_table').exists()).toBe(true);
  });

  it('loads the library on open', async () => {
    const { load } = await mountView();

    expect(load).toHaveBeenCalledWith(null);
  });

  it('loads the primary library on open when configured', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const store = useLibraryStore();
    settings.mainLibraryId = 'lib-2';
    const load = vi.spyOn(store, 'loadHomeLibrary').mockImplementation(readLibrary(store));

    mount(LibraryView, options);
    await flushPromises();

    expect(load).toHaveBeenCalledWith('lib-2');
  });

  it('shows the empty state with no tracks', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.get('.app_placeholder_title').text()).toBe('La libreria è vuota');
    expect(wrapper.find('.library_table').exists()).toBe(false);
  });

  /**
   * The bug this stands against: the view was on screen before the read had been asked for,
   * and a library with no tracks yet is indistinguishable from a library with none at all.
   * For an instant, every start of the application said the library was empty.
   */
  it('waits rather than calling the library empty before it has been read', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    // A read that never answers: the view has to hold the wait, not fall through it.
    vi.spyOn(store, 'loadHomeLibrary').mockImplementation(() => new Promise(() => {}));

    const wrapper = mount(LibraryView, options);
    await flushPromises();

    expect(wrapper.find('.library_view_loading [role="status"]').exists()).toBe(true);
    expect(wrapper.find('.app_placeholder').exists()).toBe(false);
  });

  it('shows a spinner instead of the empty state while the library loads', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.isLoading = true;
    vi.spyOn(store, 'loadHomeLibrary').mockImplementation(readLibrary(store));

    const wrapper = mount(LibraryView, options);
    await flushPromises();

    expect(wrapper.find('.library_view_loading [role="status"]').exists()).toBe(true);
    expect(wrapper.find('.app_placeholder').exists()).toBe(false);
  });

  it('shows the default player banner until it is dismissed', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.find('.default_player_banner').exists()).toBe(true);

    useSettingsStore().defaultPlayerBannerDismissed = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.default_player_banner').exists()).toBe(false);
  });

  it('shows the list when there are tracks by default', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = makeTracks(2);
    await flushPromises();

    expect(wrapper.find('.library_table').exists()).toBe(true);
    expect(wrapper.findAll('.preview_card')).toHaveLength(0);
  });

  it('shows previews once the view is switched to them', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'preview';
    store.tracks = makeTracks(2);
    await flushPromises();

    expect(wrapper.findAll('.preview_card')).toHaveLength(2);
    expect(wrapper.find('.library_table').exists()).toBe(false);
  });

  it('switches from the tracks tab to the artists tab', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    store.tracks = [
      makeTrack({ title: 'Uno', artist: 'Artist A' }),
      makeTrack({ title: 'Due', artist: 'Artist B' }),
    ];
    await flushPromises();

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Brani',
      'Autori',
      'Album',
      'Generi',
    ]);
    expect(wrapper.find('.library_table').exists()).toBe(true);

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.find('.library_table').exists()).toBe(false);
    expect(wrapper.find('.library_facet_preview').exists()).toBe(true);
    expect(wrapper.findAll('.library_facet_card')).toHaveLength(2);
    expect(wrapper.text()).toContain('Artist A');
  });

  it('clears the search when switching library sections', async () => {
    const { wrapper, store } = await mountView();

    store.tracks = makeTracks(2);
    store.setQuery('uno');
    await flushPromises();

    expect(store.query).toBe('uno');
    expect((wrapper.get('.library_toolbar_search input').element as HTMLInputElement).value).toBe(
      'uno',
    );

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    await flushPromises();

    expect(store.query).toBe('');
    expect((wrapper.get('.library_toolbar_search input').element as HTMLInputElement).value).toBe(
      '',
    );
  });

  it('opens the albums tab in preview view by default', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', album: 'Album A' }),
      makeTrack({ title: 'Green', album: 'Album B' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');

    expect(wrapper.find('.library_facet_preview').exists()).toBe(true);
    expect(wrapper.find('.library_facet_list').exists()).toBe(false);
    expect(wrapper.findAll('.library_facet_card')).toHaveLength(2);
  });

  it('opens linked tracks from a facet group in a modal', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A' }),
      makeTrack({ title: 'Green', artist: 'Artist A' }),
      makeTrack({ title: 'Red', artist: 'Artist B' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('dialog');
    expect(dialog.text()).toContain('Brani collegati a «Artist A»');
    expect(dialog.text()).toContain('2 brani');
    expect(dialog.text()).toContain('Blue');
    expect(dialog.text()).toContain('Green');
    expect(dialog.text()).not.toContain('Red');
  });

  it('shows artist albums as a horizontal preview strip above the linked track list', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'First Album', year: 1999 }),
      makeTrack({ title: 'Green', artist: 'Artist A', album: 'Second Album', year: 2001 }),
      makeTrack({ title: 'Red', artist: 'Artist B', album: 'Other Album', year: 2005 }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('dialog');
    const albumCards = dialog.findAll('.library_group_carousel_card');

    expect(dialog.find('[data-testid="artist-albums-carousel"]').exists()).toBe(true);
    expect(albumCards).toHaveLength(2);
    expect(albumCards[0]?.text()).toContain('First Album');
    expect(albumCards[0]?.text()).toContain('1999');
    expect(albumCards[0]?.text()).not.toContain('Artist A');
    expect(dialog.find('.library_table').exists()).toBe(true);
    expect(dialog.find('[data-testid="table-column-settings"]').exists()).toBe(false);
    expect(
      dialog
        .findAll('.library_table_heading')
        .map((heading) => heading.text().replace(/[▲▼]/u, '').trim()),
    ).toEqual(['Copertina', 'Nome', 'Album', 'Anno', 'Durata', '']);
  });

  it('marks the artist modal album that contains the playing track', async () => {
    const { wrapper, store } = await mountView();
    const player = usePlayerStore();
    const playingTrack = makeTrack({
      title: 'Barabba',
      artist: 'Achille Lauro',
      album: 'Barabba Mixtape',
      year: 2012,
    });
    store.tracks = [
      playingTrack,
      makeTrack({
        title: 'Ascensore per l inferno',
        artist: 'Achille Lauro',
        album: 'Ragazzi madre',
        year: 2016,
      }),
      makeTrack({ title: 'Other', artist: 'Other Artist', album: 'Other Album' }),
    ];
    player.queue = [playingTrack];
    player.index = 0;
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const playingAlbums = wrapper.get('dialog').findAll('.library_group_carousel_card_playing');

    expect(playingAlbums).toHaveLength(1);
    expect(playingAlbums[0]?.attributes('aria-current')).toBe('true');
    expect(playingAlbums[0]?.text()).toContain('Barabba Mixtape');
    expect(playingAlbums[0]?.get('[data-testid="playing-bubble"]').attributes('title')).toBe(
      'In riproduzione',
    );
  });

  it('keeps the facet view unchanged when the linked-tracks modal changes view', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', album: 'Album A' }),
      makeTrack({ title: 'Green', album: 'Album A' }),
      makeTrack({ title: 'Red', album: 'Album B' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('dialog');
    expect(dialog.find('.library_table').exists()).toBe(true);

    await dialog.get('[data-testid="view-preview"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('dialog').find('.preview_grid').exists()).toBe(true);
    expect(wrapper.get('.library_view_panel').find('.library_facet_preview').exists()).toBe(true);
    expect(wrapper.get('.library_view_panel').find('.library_facet_list').exists()).toBe(false);
  });

  it('heads the album modal with its cover, title, year, artists and genres', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({
        title: 'Blue',
        artist: 'Artist A',
        album: 'Album A',
        genre: 'Jazz',
        year: 1999,
      }),
      makeTrack({
        title: 'Green',
        artist: 'Artist B',
        album: 'Album A',
        genre: 'Fusion',
        year: 2001,
      }),
      makeTrack({ title: 'Red', artist: 'Artist C', album: 'Album B', genre: 'Rock' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('dialog');
    const summary = dialog.get('.library_album_summary');
    const artistLinks = summary.findAll(
      '.library_album_summary_artists .library_album_summary_link',
    );
    const genreLinks = summary.findAll('.library_album_summary_genres .library_album_summary_link');
    const headings = dialog
      .findAll('.library_table_heading')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    expect(summary.find('.library_album_summary_cover').exists()).toBe(true);
    expect(summary.get('.library_album_summary_name').text()).toBe('Album A');
    expect(summary.get('.library_album_summary_year').text()).toBe('1999');
    // The fields speak for themselves: no label in front of any of them.
    expect(genreLinks.map((link) => link.text())).toEqual(['Fusion', 'Jazz']);
    expect(summary.text()).not.toContain('Genere:');
    expect(summary.text()).not.toContain('Autore:');
    expect(artistLinks.map((link) => link.text())).toEqual(['Artist A', 'Artist B']);
    // The header already carries the year: the list repeats neither it nor the artists.
    expect(headings).toEqual(['Copertina', 'Nome', 'Durata', '']);
    expect(dialog.find('[data-testid="table-column-settings"]').exists()).toBe(false);

    await artistLinks[0]?.trigger('click');
    await flushPromises();

    expect(wrapper.get('dialog').text()).toContain('Brani collegati a «Artist A»');

    // The way back names where it lands, so the trail reads even three levels down.
    expect(wrapper.get('[data-testid="facet-modal-back"]').text()).toContain('Torna a «Album A»');

    await wrapper.get('[data-testid="facet-modal-back"]').trigger('click');
    await flushPromises();

    const restoredDialog = wrapper.get('dialog');
    expect(restoredDialog.text()).toContain('Brani collegati a «Album A»');
    expect(
      restoredDialog
        .findAll('.library_album_summary_genres .library_album_summary_link')
        .map((link) => link.text()),
    ).toEqual(['Fusion', 'Jazz']);
    expect(restoredDialog.find('[data-testid="facet-modal-back"]').exists()).toBe(false);
  });

  it('opens a genre of the album from its header', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Red', artist: 'Artist B', album: 'Album B', genre: 'Rock' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    await wrapper.get('.library_album_summary_genres .library_album_summary_link').trigger('click');
    await flushPromises();

    expect(wrapper.get('dialog').text()).toContain('Brani collegati a «Jazz»');
  });

  it('opens genre details on the tracks, with a tab for each section', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Green', artist: 'Artist B', album: 'Album B', genre: 'Jazz' }),
      makeTrack({ title: 'Red', artist: 'Artist C', album: 'Album C', genre: 'Rock' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[3]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('dialog');

    expect(dialog.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Brani',
      'Autori',
      'Album',
    ]);
    // Tracks are what the modal lists to begin with, and they read as a table.
    expect(dialog.find('.library_table').exists()).toBe(true);
    expect(dialog.find('.library_facet_preview').exists()).toBe(false);
    expect(dialog.text()).toContain('Blue');
    expect(dialog.text()).not.toContain('Red');
  });

  it('lists the genre tracks on fixed columns, with no way to change them', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[3]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('dialog');
    const headings = dialog
      .findAll('.library_table_heading')
      .map((heading) => heading.text().replace(/[▲▼]/u, '').trim());

    // The last heading holds the row actions, which have no label of their own.
    expect(headings).toEqual(['Copertina', 'Nome', 'Autore', 'Album', 'Anno', 'Durata', '']);
    expect(dialog.find('[data-testid="table-column-settings"]').exists()).toBe(false);
    expect(dialog.find('[data-testid="table-fit-columns"]').exists()).toBe(false);
  });

  it('swaps the genre list from the tabs, one section at a time', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Green', artist: 'Artist B', album: 'Album B', genre: 'Jazz' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[3]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    const modalTab = (index: number) => wrapper.get('dialog').findAll('[role="tab"]')[index];

    // Artists and albums are browsed by their covers, never as a table.
    await modalTab(1)?.trigger('click');
    await flushPromises();
    expect(wrapper.get('dialog').findAll('.library_facet_preview')).toHaveLength(1);
    expect(wrapper.get('dialog').find('.library_table').exists()).toBe(false);
    expect(wrapper.get('dialog').text()).toContain('Artist A');

    await modalTab(2)?.trigger('click');
    await flushPromises();
    expect(wrapper.get('dialog').findAll('.library_facet_preview')).toHaveLength(1);
    expect(wrapper.get('dialog').text()).toContain('Album A');

    await modalTab(0)?.trigger('click');
    await flushPromises();
    expect(wrapper.get('dialog').find('.library_table').exists()).toBe(true);
    expect(wrapper.get('dialog').find('.library_facet_preview').exists()).toBe(false);
  });

  it('drills from a genre section into one of its artists', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [
      makeTrack({ title: 'Blue', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ title: 'Green', artist: 'Artist B', album: 'Album B', genre: 'Jazz' }),
    ];
    await flushPromises();

    await wrapper.findAll('[role="tab"]')[3]?.trigger('click');
    await wrapper.findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    await wrapper.get('dialog').findAll('[role="tab"]')[1]?.trigger('click');
    await flushPromises();
    await wrapper.get('dialog').findAll('.library_facet_card')[0]?.trigger('click');
    await flushPromises();

    expect(wrapper.get('dialog').text()).toContain('Brani collegati a «Artist A»');
  });

  it('marks the playing track in the library', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'preview';
    const track = makeTrack();
    const player = usePlayerStore();
    store.tracks = [track];
    player.queue = [track];
    player.index = 0;
    await flushPromises();

    expect(wrapper.get('.preview_card_playing').text()).toContain(track.title);
  });

  it('uses the library name as the title when available', async () => {
    const { wrapper, store } = await mountView();
    store.libraryName = 'Jazz Archive';
    await flushPromises();

    expect(wrapper.get('.library_title_name').text()).toBe('Jazz Archive');
  });

  it('shows the no-results state when the filter finds nothing', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = makeTracks(2);
    store.setQuery('inesistente');
    await flushPromises();

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Nessun risultato');
  });

  it('shows a specific empty state when the missing-data filter finds nothing', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [makeTrack({ artist: 'Artist' })];
    store.setMissingInfoFilter('artist');
    await flushPromises();

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Nessun dato mancante');
  });

  it('shows the store error message', async () => {
    const { wrapper, store } = await mountView();
    store.errorKey = 'shellUnavailable';
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('applicazione desktop');
  });

  it('shows and closes an import result', async () => {
    const { wrapper, store } = await mountView();
    store.lastReport = { added: [makeTrack()], duplicates: [], failed: [] };
    await flushPromises();
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="import-report"]').exists()).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(wrapper.find('[data-testid="import-report"]').exists()).toBe(true);

    await wrapper.get('[data-testid="import-report"] button').trigger('click');
    expect(store.lastReport).toBeNull();
  });

  it('shows and closes the library import result', async () => {
    const { wrapper, store } = await mountView();
    store.lastLibraryImport = { added: 2, updated: 1, skipped: 0, missing: [], total: 3 };
    await flushPromises();

    const banner = wrapper.get('[data-testid="library-import-notice"]');

    expect(banner.text()).toContain('3 brani letti');

    await banner.get('[data-testid="library-banner-dismiss"]').trigger('click');
    expect(store.lastLibraryImport).toBeNull();
  });

  it('keeps a missing-file library import warning visible until it is closed', async () => {
    const { wrapper, store } = await mountView();
    store.lastLibraryImport = {
      added: 1,
      updated: 0,
      skipped: 0,
      missing: ['C:/music/gone.mp3'],
      total: 2,
    };
    await flushPromises();

    const banner = wrapper.get('[data-testid="library-import-notice"]');

    expect(banner.attributes('role')).toBe('alert');
    expect(banner.classes()).toContain('library_banner_warning');
    expect(banner.find('[data-testid="library-banner-countdown"]').exists()).toBe(false);
    expect(banner.find('[data-testid="remove-missing-from-library-import"]').exists()).toBe(true);

    await banner.get('[data-testid="library-banner-dismiss"]').trigger('click');

    expect(store.lastLibraryImport).toBeNull();
  });

  it('shows and closes the file verification summary', async () => {
    const { wrapper, store } = await mountView();
    store.lastVerification = { total: 3, missing: 1 };
    await flushPromises();

    const banner = wrapper.get('[data-testid="verification-notice"]');

    expect(banner.text()).toContain('file mancanti 1 su 3 brani');
    expect(banner.find('[data-testid="remove-missing-from-verification"]').exists()).toBe(true);

    await banner.get('[data-testid="library-banner-dismiss"]').trigger('click');
    expect(store.lastVerification).toBeNull();
  });

  it('remembers closing the verification warning for the current missing files', async () => {
    const { wrapper, store } = await mountView();
    const track = makeTrack({ missing: true });
    const settings = useSettingsStore();
    store.tracks = [track];
    store.lastVerification = { total: 1, missing: 1 };
    await flushPromises();

    await wrapper
      .get('[data-testid="verification-notice"] [data-testid="library-banner-dismiss"]')
      .trigger('click');
    await flushPromises();

    expect(settings.dismissedMissingReport).toBe(store.missingReportKey);
    store.lastVerification = { total: 1, missing: 1 };
    await flushPromises();

    expect(wrapper.find('[data-testid="verification-notice"]').exists()).toBe(false);
  });

  it('asks for confirmation before removing a track', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    const track = makeTrack();
    store.tracks = [track];
    const remove = vi.spyOn(store, 'remove').mockResolvedValue();
    await flushPromises();

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[1]?.trigger('click');
    expect(wrapper.get('dialog').text()).toContain(track.title);
    expect(remove).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="confirm-remove"]').trigger('click');
    await flushPromises();

    expect(remove).toHaveBeenCalledWith(track.id);
    expect(wrapper.find('dialog').exists()).toBe(false);
  });

  it('cancels removal without touching the library', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    store.tracks = [makeTrack()];
    const remove = vi.spyOn(store, 'remove').mockResolvedValue();
    await flushPromises();

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[1]?.trigger('click');
    await wrapper.get('.app_modal_actions button').trigger('click');

    expect(remove).not.toHaveBeenCalled();
    expect(wrapper.find('dialog').exists()).toBe(false);
  });

  it('imports files dropped on the window', async () => {
    const { store } = await mountView();
    const addPaths = vi.spyOn(store, 'addPaths').mockResolvedValue(null);

    drop.onDrop?.(['C:/music/track.mp3']);

    expect(addPaths).toHaveBeenCalledWith(['C:/music/track.mp3']);
  });

  it('opens the metadata editor from the row', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    const track = makeTrack();
    store.tracks = [track];
    vi.spyOn(store, 'coverUrl').mockReturnValue(null);
    await flushPromises();

    expect(wrapper.find('[data-testid="metadata-editor"]').exists()).toBe(false);

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[0]?.trigger('click');
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="metadata-editor"]').exists()).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(store.editingId).toBe(track.id);
    expect(wrapper.find('[data-testid="metadata-editor"]').exists()).toBe(true);
  });

  it('sorts the table from the headers', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    store.tracks = makeTracks(2);
    await flushPromises();

    await wrapper.findAll('.library_table_sort')[3]?.trigger('click');

    expect(store.sort).toEqual({ column: 'year', direction: 'asc' });
  });

  it('offers the same actions in preview view', async () => {
    const { wrapper, store } = await mountView();
    const settings = useSettingsStore();
    settings.viewMode = 'preview';
    const track = makeTrack();
    store.tracks = [track];
    const remove = vi.spyOn(store, 'remove').mockResolvedValue();
    await flushPromises();

    await wrapper.get('.preview_card .app_menu_trigger').trigger('click');
    await wrapper.findAll('.preview_card .app_menu_item')[1]?.trigger('click');
    await wrapper.get('[data-testid="confirm-remove"]').trigger('click');
    await flushPromises();

    expect(remove).toHaveBeenCalledWith(track.id);
  });

  /**
   * Every list puts its controls in the same place: the toolbar at the top of the page,
   * rather than beside the cards they act on.
   */
  it('keeps the preview controls in the toolbar, whichever tab is open', async () => {
    const { wrapper, store } = await mountView();
    const settings = useSettingsStore();
    settings.viewMode = 'preview';
    store.tracks = [makeTrack({ artist: 'Artist A', genre: 'Jazz' })];
    await flushPromises();

    const inToolbar = (selector: string) =>
      wrapper.get('.library_view_header').find(selector).exists();

    expect(inToolbar('[data-testid="preview-sort-field"]')).toBe(true);
    expect(inToolbar('[data-testid="preview-size-medium"]')).toBe(true);

    await wrapper.get('#library-tab-artists').trigger('click');
    await flushPromises();

    expect(inToolbar('[data-testid="preview-sort-field"]')).toBe(true);
    expect(inToolbar('[data-testid="preview-size-medium"]')).toBe(true);
    expect(
      wrapper.get('.library_view_panel').find('[data-testid="preview-sort-field"]').exists(),
    ).toBe(false);

    // A genre is a short list of names read in one go: no order to choose.
    await wrapper.get('#library-tab-genres').trigger('click');
    await flushPromises();

    expect(inToolbar('[data-testid="preview-sort-field"]')).toBe(false);
    expect(inToolbar('[data-testid="preview-size-medium"]')).toBe(true);
  });

  it('remembers a card size for each page on its own', async () => {
    const { wrapper, store } = await mountView();
    const settings = useSettingsStore();
    settings.viewMode = 'preview';
    store.tracks = [makeTrack({ artist: 'Artist A' })];
    await flushPromises();

    await wrapper.get('[data-testid="preview-size-large"]').trigger('click');
    await wrapper.get('#library-tab-artists').trigger('click');
    await flushPromises();

    expect(settings.previewSizes.tracks).toBe('large');
    expect(settings.previewSizes.artists).toBe('medium');
    expect(wrapper.get('[data-testid="preview-size-medium"]').attributes('aria-pressed')).toBe(
      'true',
    );
  });

  it('selects multiple tracks with Ctrl and Shift and opens bulk editing', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    const tracks = makeTracks(4);
    store.tracks = tracks;
    await flushPromises();

    await wrapper.findAll('.library_row')[0]?.trigger('click');
    await wrapper.findAll('.library_row')[2]?.trigger('click', { ctrlKey: true });
    expect(store.selectedIds).toEqual([tracks[0]?.id, tracks[2]?.id]);

    await wrapper.findAll('.library_row')[3]?.trigger('click', { shiftKey: true });
    expect(store.selectedIds).toEqual([tracks[2]?.id, tracks[3]?.id]);

    await wrapper.get('[data-testid="bulk-edit-open"]').trigger('click');
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="bulk-metadata-editor"]').exists()).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(wrapper.find('[data-testid="bulk-metadata-editor"]').exists()).toBe(true);
  });

  it('says the view is filtered, and offers the way out of it', async () => {
    const { wrapper, store } = await mountView();

    expect(wrapper.find('[data-testid="missing-info-banner"]').exists()).toBe(false);

    store.setMissingInfoFilter('cover');
    await flushPromises();

    const banner = wrapper.get('[data-testid="missing-info-banner"]');

    expect(banner.text()).toContain('Vista filtrata');
    // The name of the field is written as the interface writes it everywhere else: lowering
    // its case would be wrong in German, where a noun keeps its capital.
    expect(banner.text()).toContain('Copertina');
    // A state, not an event: the banner has no close of its own.
    expect(banner.find('[data-testid="library-banner-dismiss"]').exists()).toBe(false);

    await banner.get('[data-testid="missing-info-reset"]').trigger('click');

    expect(store.missingInfoFilter).toBe('all');
    expect(wrapper.find('[data-testid="missing-info-banner"]').exists()).toBe(false);
  });

  it('does not open the player on a track whose file is gone', async () => {
    const { wrapper, store } = await mountView();
    useSettingsStore().viewMode = 'table';
    const track = makeTrack({ title: 'Gone', missing: true });
    store.tracks = [track];
    vi.spyOn(store, 'refreshTrack').mockResolvedValue(track);
    const player = usePlayerStore();
    const playFrom = vi.spyOn(player, 'playFrom').mockResolvedValue();
    await flushPromises();

    await wrapper.get('.library_row').trigger('dblclick');
    await flushPromises();

    expect(playFrom).not.toHaveBeenCalled();

    const modal = wrapper.get('dialog');

    expect(modal.text()).toContain('«Gone» non può essere riprodotto');
    expect(modal.find('[data-testid="remove-missing-from-playback"]').exists()).toBe(true);

    await modal.findAll('button')[0]?.trigger('click');

    expect(wrapper.find('dialog').exists()).toBe(false);
  });

  it('shows the direct missing-track warning even after the library warning was dismissed', async () => {
    const { wrapper, store } = await mountView();
    const settings = useSettingsStore();
    settings.viewMode = 'preview';
    const track = makeTrack({ title: 'Gone', missing: true });
    store.tracks = [track];
    settings.dismissedMissingReport = store.missingReportKey;
    vi.spyOn(store, 'refreshTrack').mockResolvedValue(track);
    await flushPromises();

    await wrapper.find('.preview_card_select').trigger('dblclick');
    await flushPromises();

    expect(wrapper.find('dialog').exists()).toBe(true);
  });

  it('flags on the banner the files that left their place', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [makeTrack({ title: 'Gone', missing: true })];
    store.lastRefresh = { refreshed: 0, missing: ['C:/music/gone.mp3'] };
    await flushPromises();

    const banner = wrapper.get('[data-testid="refresh-missing"]');

    expect(banner.attributes('role')).toBe('alert');
    // Impersonal, and about the file rather than about the reader.
    expect(banner.text()).toContain('1 file non risulta più disponibile nel percorso registrato');
    expect(banner.classes()).toContain('library_banner_warning');
    // The row says it too, next to the title it belongs to.
    expect(wrapper.find('.library_row_missing, .preview_card_missing').exists()).toBe(true);
  });

  it('keeps the missing-file warning closed once it has been answered for', async () => {
    const { wrapper, store } = await mountView();
    const settings = useSettingsStore();
    store.tracks = [makeTrack({ title: 'Gone', missing: true })];
    store.lastRefresh = { refreshed: 0, missing: ['C:/music/gone.mp3'] };
    await flushPromises();

    const key = store.missingReportKey;

    await wrapper
      .get('[data-testid="refresh-missing"] [data-testid="library-banner-dismiss"]')
      .trigger('click');
    await flushPromises();

    // What was closed is written down, so the answer outlives the session.
    expect(key).not.toBe('');
    expect(settings.dismissedMissingReport).toBe(key);

    // The same check running again — opening the library, closing a dialog — says nothing new.
    store.lastRefresh = { refreshed: 0, missing: ['C:/music/gone.mp3'] };
    await flushPromises();

    expect(wrapper.find('[data-testid="refresh-missing"]').exists()).toBe(false);
    // The count beside the tabs is what keeps the situation on screen.
    expect(wrapper.get('[data-testid="missing-count"]').text()).toContain('1');
  });

  it('raises the warning again, with the new count, when another file goes', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [makeTrack({ title: 'Gone', missing: true })];
    store.lastRefresh = { refreshed: 0, missing: ['C:/music/gone.mp3'] };
    await flushPromises();

    await wrapper
      .get('[data-testid="refresh-missing"] [data-testid="library-banner-dismiss"]')
      .trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="refresh-missing"]').exists()).toBe(false);

    store.lastRefresh = { refreshed: 0, missing: ['C:/music/gone.mp3', 'C:/music/second.mp3'] };
    await flushPromises();

    const banner = wrapper.get('[data-testid="refresh-missing"]');

    expect(banner.text()).toContain('2 file non risultano più disponibili');
  });

  it('forgets the answer once a check finds nothing gone', async () => {
    const { wrapper, store } = await mountView();
    const settings = useSettingsStore();
    store.tracks = [makeTrack({ title: 'Gone', missing: true })];
    store.lastRefresh = { refreshed: 0, missing: ['C:/music/gone.mp3'] };
    await flushPromises();

    await wrapper
      .get('[data-testid="refresh-missing"] [data-testid="library-banner-dismiss"]')
      .trigger('click');
    await flushPromises();

    store.lastRefresh = { refreshed: 0, missing: [] };
    await flushPromises();

    expect(settings.dismissedMissingReport).toBe('');

    // The same file going a second time is news again, not an answer already given.
    store.lastRefresh = { refreshed: 0, missing: ['C:/music/gone.mp3'] };
    await flushPromises();

    expect(wrapper.find('[data-testid="refresh-missing"]').exists()).toBe(true);
  });

  it('notes the tracks brought up to date, without raising an alarm', async () => {
    const { wrapper, store } = await mountView();
    store.tracks = [makeTrack()];
    store.lastRefresh = { refreshed: 3, missing: [] };
    await flushPromises();

    expect(wrapper.find('[data-testid="refresh-missing"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="refresh-updated"]').text()).toContain('3');
  });

  it('notes a file that was missing and is found again on reload', async () => {
    const { wrapper, store } = await mountView();
    store.lastRefresh = { refreshed: 1, missing: [] };
    store.lastRefreshRecovered = 1;
    await flushPromises();

    expect(wrapper.get('[data-testid="refresh-recovered"]').text()).toContain(
      'Trovati di nuovo 1 file',
    );
  });
});
