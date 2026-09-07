import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import type { TrackView } from '@/types/library';

import PreviewCard from '@/components/library/preview/PreviewCard.vue';

beforeEach(() => {
  resetI18n();
});

function mountCard(track: TrackView = makeTrack(), selected = false, playing = false) {
  return mount(PreviewCard, { ...withPinia(), props: { track, selected, playing } });
}

describe('PreviewCard', () => {
  it('shows title, artist, and album', () => {
    const wrapper = mountCard(makeTrack({ title: 'Track', artist: 'Artist', album: 'Album' }));

    expect(wrapper.get('.preview_card_title').text()).toBe('Track');
    expect(wrapper.findAll('.preview_card_meta').map((meta) => meta.text())).toEqual([
      'Artist',
      'Album',
    ]);
  });

  it('uses a dash for missing fields', () => {
    const wrapper = mountCard(makeTrack({ artist: null, album: null }));

    expect(wrapper.findAll('.preview_card_meta').map((meta) => meta.text())).toEqual(['—', '—']);
  });

  it('drops the lines the caller does not ask for', () => {
    const wrapper = mount(PreviewCard, {
      ...withPinia(),
      props: {
        track: makeTrack({ title: 'Track', artist: 'Artist', album: 'Album' }),
        selected: false,
        playing: false,
        metaKeys: [],
      },
    });

    expect(wrapper.get('.preview_card_title').text()).toBe('Track');
    expect(wrapper.findAll('.preview_card_meta')).toHaveLength(0);
  });

  it('includes the cover in card format', () => {
    const wrapper = mountCard();

    expect(wrapper.find('.cover_image_card').exists()).toBe(true);
  });

  it('highlights the selected card', () => {
    const wrapper = mountCard(makeTrack(), true);

    expect(wrapper.classes()).toContain('preview_card_selected');
    expect(wrapper.get('.preview_card_select').attributes('aria-pressed')).toBe('true');
  });

  it('marks the playing card', () => {
    const wrapper = mountCard(makeTrack(), false, true);

    expect(wrapper.classes()).toContain('preview_card_playing');
    expect(wrapper.get('.preview_card_select').attributes('aria-current')).toBe('true');
    const bubble = wrapper.get('[data-testid="playing-bubble"]');

    // The state reads as a notification on the cover, not as a line of the body.
    expect(bubble.attributes('title')).toBe('In riproduzione');
    expect(bubble.get('.app_icon').classes()).toContain('app_icon_play');
    expect(bubble.get('.app_icon').attributes('aria-label')).toBe('In riproduzione');
    expect(wrapper.get('.preview_card_body').text()).not.toContain('In riproduzione');
  });

  it('is selected through a button rather than a role', () => {
    const wrapper = mountCard(makeTrack({ title: 'Track' }));

    // A native button rather than a role on the card: it takes focus and reads its state
    // without an ARIA role, and it leaves room for the actions menu next to it.
    expect(wrapper.element.tagName).toBe('DIV');
    expect(wrapper.attributes('role')).toBeUndefined();

    const button = wrapper.get('.preview_card_select');

    expect(button.attributes('aria-pressed')).toBe('false');
    expect(button.attributes('aria-label')).toBe('Track');
  });

  it('reads the title on hover, from anywhere on the card', async () => {
    const wrapper = mountCard(makeTrack({ title: 'Blue in Green' }));

    // The button covers the card, so the tooltip hangs from it rather than from the heading.
    await wrapper.get('.preview_card_hover').trigger('mouseenter');

    expect(wrapper.get('.app_tooltip_bubble').text()).toBe('Blue in Green');
  });

  it('reports files missing from disk as a corner alert', () => {
    const wrapper = mountCard(makeTrack({ missing: true }));
    const bubble = wrapper.get('[data-testid="missing-bubble"]');

    expect(bubble.attributes('title')).toBe('File non più presente su disco');
    expect(bubble.get('.app_icon').classes()).toContain('app_icon_warning');
    expect(wrapper.get('.preview_card_body').text()).not.toContain('File non più presente');
  });

  it('leaves the corner clear when the file is there', () => {
    const wrapper = mountCard(makeTrack({ missing: false }));

    expect(wrapper.find('[data-testid="missing-bubble"]').exists()).toBe(false);
  });

  it('emits selection when the card button is pressed', async () => {
    const track = makeTrack();
    const wrapper = mountCard(track);

    await wrapper.get('.preview_card_select').trigger('click');
    await wrapper.get('.preview_card_select').trigger('click', { ctrlKey: true });

    expect(wrapper.emitted('select')).toEqual([
      [{ id: track.id, additive: false, range: false }],
      [{ id: track.id, additive: true, range: false }],
    ]);
  });

  it('offers the same actions as list view from the menu', async () => {
    const wrapper = mountCard(makeTrack({ title: 'Track' }));

    await wrapper.get('.app_menu_trigger').trigger('click');

    expect(
      wrapper.findAll('.app_menu_item').map((item) => item.get('.app_menu_item_label').text()),
    ).toEqual(['Modifica', 'Elimina']);
  });

  it('emits edit and remove without selecting the card', async () => {
    const track = makeTrack();
    const wrapper = mountCard(track);

    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[0]?.trigger('click');
    await wrapper.get('.app_menu_trigger').trigger('click');
    await wrapper.findAll('.app_menu_item')[1]?.trigger('click');

    expect(wrapper.emitted('edit')).toEqual([[track]]);
    expect(wrapper.emitted('remove')).toEqual([[track]]);
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('does not allow editing a file missing from disk', async () => {
    const wrapper = mountCard(makeTrack({ missing: true }));

    await wrapper.get('.app_menu_trigger').trigger('click');

    expect(wrapper.findAll('.app_menu_item')[0]?.attributes('disabled')).toBeDefined();
  });
});
