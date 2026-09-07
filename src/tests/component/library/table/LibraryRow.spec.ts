import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

import LibraryRow from '@/components/library/table/LibraryRow.vue';

beforeEach(() => {
  resetI18n();
});

function mountRow(track = makeTrack(), selected = false, playing = false) {
  return mount(LibraryRow, { ...withPinia(), props: { track, selected, playing } });
}

describe('LibraryRow', () => {
  it('shows track fields in the columns', () => {
    const track = makeTrack({
      title: 'Track',
      artist: 'Artist',
      album: 'Album',
      year: 1999,
      genre: 'Jazz',
    });

    const cells = mountRow(track).findAll('td');

    expect(cells[1]?.text()).toContain('Track');
    expect(cells[2]?.text()).toBe('Artist');
    expect(cells[3]?.text()).toBe('Album');
    expect(cells[4]?.text()).toBe('1999');
    expect(cells[5]?.text()).toBe('Jazz');
  });

  it('carries the full value of the truncatable cells as a tooltip', () => {
    const track = makeTrack({
      title: 'A very long title that the column cannot show whole',
      artist: 'Artist',
      album: 'Album',
    });

    const texts = mountRow(track).findAll('.library_row_text');

    expect(texts[0]?.attributes('title')).toBe(
      'A very long title that the column cannot show whole',
    );
    expect(texts[1]?.attributes('title')).toBe('Artist');
    expect(texts[2]?.attributes('title')).toBe('Album');
  });

  it('shows a dash for missing fields', () => {
    const cells = mountRow(
      makeTrack({ artist: null, album: null, year: null, genre: null }),
    ).findAll('td');

    expect(cells[2]?.text()).toBe('—');
    expect(cells[3]?.text()).toBe('—');
    expect(cells[4]?.text()).toBe('—');
    expect(cells[5]?.text()).toBe('—');
  });

  it('formats duration', () => {
    const wrapper = mountRow(makeTrack({ durationMs: 185_000 }));

    expect(wrapper.get('.library_row_duration').text()).toBe('3:05');
  });

  it('shows optional metadata columns when they are visible', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    await settings.setTableColumnVisible('format', true);
    await settings.setTableColumnVisible('path', true);

    const wrapper = mount(LibraryRow, {
      ...options,
      props: {
        track: makeTrack({ format: 'flac', path: 'C:/music/song.flac' }),
        selected: false,
        playing: false,
      },
    });

    expect(wrapper.text()).toContain('FLAC');
    expect(wrapper.text()).toContain('C:/music/song.flac');
  });

  it('reports files missing from disk', () => {
    const wrapper = mountRow(makeTrack({ missing: true }));

    expect(wrapper.classes()).toContain('library_row_missing');
    expect(wrapper.get('.library_row_badge').text()).toContain('File non più presente su disco');
    expect(wrapper.find('.library_row_badge .app_icon_warning').exists()).toBe(true);
  });

  it('highlights the selected row', () => {
    const wrapper = mountRow(makeTrack(), true);

    expect(wrapper.classes()).toContain('library_row_selected');
    expect(wrapper.attributes('aria-selected')).toBe('true');
  });

  it('marks the playing row', () => {
    const wrapper = mountRow(makeTrack(), false, true);

    expect(wrapper.classes()).toContain('library_row_playing');
    expect(wrapper.attributes('aria-current')).toBe('true');
    expect(wrapper.get('.library_row_badge_playing').text()).toContain('In riproduzione');
  });

  it('spells the playing badge out while the title column has room', () => {
    const wrapper = mountRow(makeTrack(), false, true);
    const badge = wrapper.get('.library_row_badge_playing');

    expect(badge.text()).toContain('In riproduzione');
    expect(badge.classes()).not.toContain('library_row_badge_compact');
  });

  it('keeps only the symbol once the title column is narrow', () => {
    const wrapper = mount(LibraryRow, {
      ...withPinia(),
      props: {
        track: makeTrack(),
        selected: false,
        playing: true,
        columns: [
          { key: 'cover', visible: true, width: 48 },
          { key: 'title', visible: true, width: 180 },
        ],
      },
    });
    const badge = wrapper.get('.library_row_badge_playing');

    // The meaning has to survive: the label moves to the tooltip and to the icon.
    expect(badge.text()).not.toContain('In riproduzione');
    expect(badge.classes()).toContain('library_row_badge_compact');
    expect(badge.attributes('title')).toBe('In riproduzione');
    expect(badge.get('.app_icon').attributes('aria-label')).toBe('In riproduzione');
  });

  it('fills the cover column with the cover', () => {
    const wrapper = mountRow();

    expect(wrapper.get('.library_row_cover .cover_image').classes()).toContain('cover_image_fill');
  });

  it('uses the cover gradient on the playing row', () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.setCoverAccent({
      rgb: '10 20 30',
      surfaceGradient: 'linear-gradient(red, transparent)',
      rowGradient: 'linear-gradient(90deg, rgb(10 20 30 / 26%), transparent)',
    });

    const wrapper = mount(LibraryRow, {
      ...options,
      props: { track: makeTrack(), selected: false, playing: true },
    });

    expect(wrapper.attributes('style')).toContain('--cover_row_gradient');
  });

  it('emits selection on click and Enter', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.trigger('click');
    await wrapper.trigger('keydown.enter');

    expect(wrapper.emitted('select')).toEqual([
      [{ id: track.id, additive: false, range: false }],
      [{ id: track.id, additive: false, range: false }],
    ]);
  });

  it('emits removal without selecting the row', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[1]?.trigger('click');

    expect(wrapper.emitted('remove')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('opens the same actions menu from the right click menu', async () => {
    const wrapper = mountRow(makeTrack());

    await wrapper.trigger('contextmenu');

    expect(wrapper.find('.library_row .app_menu_trigger').attributes('aria-expanded')).toBe('true');
    expect(wrapper.findAll('.library_row .app_menu_item_label').map((item) => item.text())).toEqual(
      ['Modifica', 'Elimina'],
    );
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('emits the metadata edit request', async () => {
    const track = makeTrack();
    const wrapper = mountRow(track);

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');
    await wrapper.findAll('.library_row .app_menu_item')[0]?.trigger('click');

    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('does not allow editing a missing file', async () => {
    const wrapper = mountRow(makeTrack({ missing: true }));

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');

    expect(wrapper.findAll('.library_row .app_menu_item')[0]?.attributes('disabled')).toBeDefined();
  });

  it('describes the menu to screen readers', async () => {
    const wrapper = mountRow(makeTrack({ title: 'Track' }));

    expect(wrapper.get('.library_row .app_menu_trigger').attributes('aria-label')).toBe(
      'Azioni per «Track»',
    );

    await wrapper.get('.library_row .app_menu_trigger').trigger('click');

    expect(
      wrapper
        .findAll('.library_row .app_menu_item')
        .map((item) => item.get('.app_menu_item_label').text()),
    ).toEqual(['Modifica', 'Elimina']);
    expect(
      wrapper.findAll('.library_row .app_menu_item').map((item) => item.attributes('aria-label')),
    ).toEqual(['Modifica i metadati di «Track»', 'Rimuovi «Track» dalla libreria']);
  });
});
