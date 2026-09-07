import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack, makeTracks } from '@tests/support/tracks';
import { useSettingsStore } from '@/stores/settings';
import type { TrackView } from '@/types/library';

import PreviewGrid from '@/components/library/preview/PreviewGrid.vue';

beforeEach(() => {
  resetI18n();
});

function mountGrid(
  tracks: TrackView[],
  selectedIds: string[] = [],
  playingId: string | null = null,
) {
  return mount(PreviewGrid, { ...withPinia(), props: { tracks, selectedIds, playingId } });
}

describe('PreviewGrid', () => {
  it('sizes its cards from the setting', async () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(PreviewGrid, {
      ...options,
      props: { tracks: [makeTrack()], selectedIds: [], playingId: null },
    });

    expect(wrapper.get('ul').attributes('style')).toContain('--preview_card_width: 9rem');

    await settings.setPreviewSize('tracks', 'large');

    expect(wrapper.get('ul').attributes('style')).toContain('--preview_card_width: 12rem');
  });

  it('renders one card per track', () => {
    const wrapper = mountGrid(makeTracks(5));

    expect(wrapper.findAll('.preview_card')).toHaveLength(5);
  });

  it('is a plain list of cards, each selected through its own button', () => {
    const wrapper = mountGrid(makeTracks(2));

    // A list of items rather than a listbox: the cards carry an actions menu, which an
    // option is not allowed to contain.
    expect(wrapper.element.tagName).toBe('UL');
    expect(wrapper.attributes('role')).toBeUndefined();
    expect(wrapper.findAll('li.preview_grid_item .preview_card')).toHaveLength(2);
    expect(wrapper.findAll('.preview_card_select[aria-pressed]')).toHaveLength(2);
  });

  it('renders nothing for an empty list', () => {
    const wrapper = mountGrid([]);

    expect(wrapper.findAll('.preview_card')).toHaveLength(0);
  });

  it('marks only the current card as selected', () => {
    const tracks = makeTracks(3);
    const selectedTrack = tracks[1];
    const wrapper = mountGrid(tracks, selectedTrack === undefined ? [] : [selectedTrack.id]);

    const selected = wrapper.findAll('.preview_card_selected');

    expect(selected).toHaveLength(1);
    expect(selected[0]?.get('.preview_card_title').text()).toBe(selectedTrack?.title);
  });

  it('marks only the current card as playing', () => {
    const tracks = makeTracks(3);
    const playingTrack = tracks[2];
    const wrapper = mountGrid(tracks, [], playingTrack?.id ?? null);

    const playing = wrapper.findAll('.preview_card_playing');

    expect(playing).toHaveLength(1);
    expect(playing[0]?.get('.preview_card_title').text()).toBe(playingTrack?.title);
  });

  it('forwards selection and menu actions', async () => {
    const track = makeTrack();
    const wrapper = mountGrid([track]);

    await wrapper.get('.preview_card_select').trigger('click');
    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[0]?.trigger('click');
    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[1]?.trigger('click');

    expect(wrapper.emitted('select')).toEqual([[{ id: track.id, additive: false, range: false }]]);
    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('remove')).toEqual([[track]]);
  });
});
