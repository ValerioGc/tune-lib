import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import CoverImage from '@/components/library/CoverImage.vue';

beforeEach(() => {
  resetI18n();
});

describe('CoverImage', () => {
  it('shows a placeholder when the track has no cover', () => {
    const options = withPinia();
    vi.spyOn(useLibraryStore(), 'coverUrl').mockReturnValue(null);

    const wrapper = mount(CoverImage, { ...options, props: { track: makeTrack() } });

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.get('.cover_image_fallback').attributes('aria-label')).toBe('Nessuna copertina');
  });

  it('points the image at the address the store gives', () => {
    const options = withPinia();
    vi.spyOn(useLibraryStore(), 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');

    const wrapper = mount(CoverImage, { ...options, props: { track: makeTrack() } });

    expect(wrapper.get('img').attributes('src')).toBe('cover://localhost/track.mp3?v=0');
  });

  it('animates a placeholder until the picture is ready', async () => {
    const options = withPinia();
    vi.spyOn(useLibraryStore(), 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');
    const wrapper = mount(CoverImage, { ...options, props: { track: makeTrack() } });

    expect(wrapper.find('.cover_image_skeleton').exists()).toBe(true);
    expect(wrapper.get('img').classes()).toContain('cover_image_picture_loading');

    await wrapper.get('img').trigger('load');

    expect(wrapper.find('.cover_image_skeleton').exists()).toBe(false);
    expect(wrapper.get('img').classes()).not.toContain('cover_image_picture_loading');
  });

  it('applies the requested size', () => {
    const wrapper = mount(CoverImage, {
      ...withPinia(),
      props: { track: makeTrack(), size: 'card' },
    });

    expect(wrapper.classes()).toContain('cover_image_card');
  });

  /** The rows off screen are the browser's business now, not the component's. */
  it('leaves the loading to the browser unless it is told to hurry', () => {
    const options = withPinia();
    vi.spyOn(useLibraryStore(), 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');

    const lazy = mount(CoverImage, { ...options, props: { track: makeTrack() } });
    const eager = mount(CoverImage, { ...options, props: { track: makeTrack(), eager: true } });

    expect(lazy.get('img').attributes('loading')).toBe('lazy');
    expect(eager.get('img').attributes('loading')).toBe('eager');
  });

  it('falls back to the placeholder when the picture cannot be served', async () => {
    const options = withPinia();
    vi.spyOn(useLibraryStore(), 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');
    const wrapper = mount(CoverImage, { ...options, props: { track: makeTrack() } });

    await wrapper.get('img').trigger('error');

    expect(wrapper.find('img').exists()).toBe(false);
    expect(wrapper.find('.cover_image_fallback').exists()).toBe(true);
  });

  it('tries again when the track changes', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    vi.spyOn(store, 'coverUrl').mockReturnValue('cover://localhost/one.mp3?v=0');
    const wrapper = mount(CoverImage, { ...options, props: { track: makeTrack({ id: 'one' }) } });
    await wrapper.get('img').trigger('error');

    vi.spyOn(store, 'coverUrl').mockReturnValue('cover://localhost/two.mp3?v=0');
    await wrapper.setProps({ track: makeTrack({ id: 'two' }) });

    expect(wrapper.get('img').attributes('src')).toBe('cover://localhost/two.mp3?v=0');
  });
});
