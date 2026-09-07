import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack, makeTracks } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import { isWindowVisible } from '@/composables/useForeground';

const mocks = vi.hoisted(() => ({
  playbackUrl: vi.fn(),
  createAudioEngine: vi.fn(),
  dominantCoverAccent: vi.fn(),
}));

vi.mock('@/services/playback-api', () => ({ playbackUrl: mocks.playbackUrl }));
vi.mock('@/services/audio-engine', () => ({ createAudioEngine: mocks.createAudioEngine }));
vi.mock('@/services/cover-accent', () => ({ dominantCoverAccent: mocks.dominantCoverAccent }));

import PlayerDock from '@/components/player/layout/PlayerDock.vue';

const wrappers: VueWrapper[] = [];

beforeEach(() => {
  resetI18n();
  vi.clearAllMocks();
  mocks.playbackUrl.mockResolvedValue('asset://track.mp3');
  mocks.createAudioEngine.mockReturnValue({
    load: vi.fn(),
    preload: vi.fn(),
    cancelPreload: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setTrackGain: vi.fn(),
    release: vi.fn(),
  });
  mocks.dominantCoverAccent.mockResolvedValue({
    rgb: '10 20 30',
    surfaceGradient: 'linear-gradient(rgb(10 20 30 / 28%), transparent)',
    rowGradient: 'linear-gradient(90deg, rgb(10 20 30 / 26%), transparent)',
  });
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

function mountDock(options: ReturnType<typeof withPinia> = withPinia(), attachTo?: HTMLElement) {
  const wrapper = mount(PlayerDock, {
    ...options,
    ...(attachTo === undefined ? {} : { attachTo }),
  });
  wrappers.push(wrapper);

  return wrapper;
}

async function waitForFullView(wrapper: VueWrapper) {
  await vi.waitFor(
    () => {
      expect(wrapper.find('.player_full').exists()).toBe(true);
    },
    { timeout: 5000 },
  );
}

describe('PlayerDock', () => {
  it('retains the existing gradient when a hidden window becomes visible again', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    vi.spyOn(useLibraryStore(), 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');
    await player.play(makeTrack({ hasCover: true }));
    mountDock(options);
    await flushPromises();
    const accent = player.coverAccent;
    const reads = mocks.dominantCoverAccent.mock.calls.length;
    try {
      isWindowVisible.value = false;
      await flushPromises();
      expect(player.coverAccent).toEqual(accent);
    } finally {
      isWindowVisible.value = true;
    }
    await flushPromises();
    expect(player.coverAccent).toEqual(accent);
    expect(mocks.dominantCoverAccent).toHaveBeenCalledTimes(reads);
  });
  it('stays invisible until something plays', () => {
    const wrapper = mountDock();

    expect(wrapper.find('.player_bar').exists()).toBe(false);
    expect(wrapper.find('.player_full').exists()).toBe(false);
  });

  it('shows the bottom bar when a track starts', async () => {
    const options = withPinia();
    const player = usePlayerStore();

    const wrapper = mountDock(options);
    player.play(makeTrack({ title: 'Track', artist: 'Artist' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.player_bar_title').text()).toBe('Track');
    expect(wrapper.get('.player_bar_artist').text()).toBe('Artist');
    expect(wrapper.find('.player_full').exists()).toBe(false);
  });

  it('steps aside on the settings and on the help, without stopping the sound', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const navigation = useNavigationStore();
    await player.play(makeTrack({ title: 'Track' }));
    player.expand();

    const wrapper = mountDock(options);
    await waitForFullView(wrapper);
    expect(wrapper.find('.player_full').exists()).toBe(true);

    navigation.go('settings');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.player_bar').exists()).toBe(false);
    expect(wrapper.find('.player_full').exists()).toBe(false);
    // The view goes, the queue stays: the engine keeps playing behind the page.
    expect(player.currentTrack?.title).toBe('Track');
    expect(player.isExpanded).toBe(false);

    navigation.go('library');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.player_bar').exists()).toBe(true);
  });

  it('closes the player completely from the full view', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const settings = useSettingsStore();
    settings.keepPlayerOpen = true;
    await player.play(makeTrack({ title: 'Track' }));
    player.expand();

    const wrapper = mountDock(options);
    await waitForFullView(wrapper);
    await wrapper.get('[data-testid="player-full-close"]').trigger('click');

    // The close command is definitive even when the minimized-player preference is enabled.
    expect(player.isPlaying).toBe(false);
    expect(player.currentTrack).toBeNull();
    expect(wrapper.find('.player_bar').exists()).toBe(false);
  });

  it('closes for good when the bar itself is closed', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const settings = useSettingsStore();
    // Nothing smaller than the bar to fall back to, so the setting has no say here.
    settings.keepPlayerOpen = true;
    await player.play(makeTrack({ title: 'Track' }));

    const wrapper = mountDock(options);
    await wrapper.get('[data-testid="player-close"]').trigger('click');

    expect(player.currentTrack).toBeNull();
    expect(wrapper.find('.player_bar').exists()).toBe(false);
  });

  it('applies the cover gradient to the player', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const library = useLibraryStore();
    vi.spyOn(library, 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');
    await player.play(makeTrack({ hasCover: true }));

    const wrapper = mountDock(options);
    await flushPromises();

    // The shape and the origin travel with the intensity, as they do for the app background.
    expect(mocks.dominantCoverAccent).toHaveBeenCalledWith('cover://localhost/track.mp3?v=0', {
      intensity: 100,
      style: 'orbs',
      direction: 'topLeft',
    });
    expect(player.coverAccent?.rgb).toBe('10 20 30');
    expect(wrapper.get('.player_bar').classes()).toContain('player_bar_accented');
  });

  it('does not load the color when the gradient is disabled', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const settings = useSettingsStore();
    settings.coverGradientEnabled = false;
    settings.miniPlayerGradient = false;
    player.setCoverAccent({
      rgb: '10 20 30',
      surfaceGradient: 'linear-gradient(red, transparent)',
      rowGradient: 'linear-gradient(red, transparent)',
    });
    await player.play(makeTrack({ hasCover: true }));

    mountDock(options);
    await flushPromises();

    expect(mocks.dominantCoverAccent).not.toHaveBeenCalled();
    expect(player.coverAccent).toBeNull();
  });

  it('loads the cover color for the mini player on its own', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const library = useLibraryStore();
    const settings = useSettingsStore();
    settings.coverGradientEnabled = false;
    settings.miniPlayerGradient = true;
    vi.spyOn(library, 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');
    await player.play(makeTrack({ hasCover: true }));

    mountDock(options);
    await flushPromises();

    expect(mocks.dominantCoverAccent).toHaveBeenCalledWith('cover://localhost/track.mp3?v=0', {
      intensity: 100,
      style: 'orbs',
      direction: 'topLeft',
    });
    expect(player.coverAccent?.surfaceGradient).toContain('10 20 30');
  });

  it('switches to full page with the arrow and back', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack({ title: 'Track' }));

    const wrapper = mountDock(options);
    await wrapper.get('[data-testid="player-expand"]').trigger('click');
    await waitForFullView(wrapper);

    expect(player.isExpanded).toBe(true);
    expect(wrapper.get('.player_full_title').text()).toBe('Track');
    expect(wrapper.find('.player_bar').exists()).toBe(false);
    expect(
      wrapper.get('.player_full_header_actions [data-testid="player-collapse"]'),
    ).toBeDefined();
    expect(wrapper.find('.player_full_header_start [data-testid="player-collapse"]').exists()).toBe(
      false,
    );

    await wrapper.get('[data-testid="player-collapse"]').trigger('click');

    expect(player.isExpanded).toBe(false);
    expect(wrapper.find('.player_bar').exists()).toBe(true);
  });

  it('opens the tracks connected to the album, the artist and the genre', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const library = useLibraryStore();
    const track = makeTrack({ title: 'Track', artist: 'Artist', album: 'Album', genre: 'Jazz' });
    library.tracks = [track, makeTrack({ id: 'other', title: 'Other', album: 'Album' })];
    await player.play(track);
    player.expand();

    const wrapper = mountDock(options);
    await waitForFullView(wrapper);

    await wrapper.get('[data-testid="player-open-album"]').trigger('click');

    // The list arrives without leaving the player, and over it: the full view covers the
    // window, so a dialog underneath would open out of sight.
    expect(wrapper.find('.app_modal').exists()).toBe(true);
    expect(wrapper.get('dialog').text()).toContain('Brani collegati a «Album»');
    expect(wrapper.findAll('.player_related_title').map((title) => title.text())).toEqual([
      'Track',
      'Other',
    ]);

    // The year gathers nothing to listen through, so it stays plain text.
    expect(wrapper.find('[data-testid="player-open-year"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="player-open-artist"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="player-open-genre"]').exists()).toBe(true);
  });

  it('closes the player from the bar', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack());

    const wrapper = mountDock(options);
    await wrapper.get('[data-testid="player-close"]').trigger('click');

    expect(player.isActive).toBe(false);
    expect(wrapper.find('.player_bar').exists()).toBe(false);
  });

  it('collapses the full page view with Escape', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    player.play(makeTrack());
    player.expand();

    const wrapper = mountDock(options, document.body);
    await waitForFullView(wrapper);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(player.isExpanded).toBe(false);
  });

  it('puts title and artist above the cover', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ title: 'Track', artist: 'Artist' }));
    player.expand();

    const wrapper = mountDock(options);
    await waitForFullView(wrapper);
    const ordine = wrapper
      .findAll('.player_full_heading, .player_full_cover, .player_full_details')
      .map((blocco) => blocco.classes()[0]);

    expect(wrapper.get('.player_full_title').text()).toBe('Track');
    expect(wrapper.get('.player_full_artist').text()).toBe('Artist');
    expect(ordine).toEqual(['player_full_heading', 'player_full_cover', 'player_full_details']);
  });

  it('lists album, year, and genre under the cover', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ album: 'Album', year: 2000, genre: 'Rock' }));
    player.expand();

    const wrapper = mountDock(options);
    await waitForFullView(wrapper);

    expect(wrapper.findAll('.player_full_detail_label').map((item) => item.text())).toEqual([
      'Album',
      'Anno',
      'Genere',
    ]);
    expect(wrapper.findAll('.player_full_detail_value').map((item) => item.text())).toEqual([
      'Album',
      '2000',
      'Rock',
    ]);
  });

  it('shows a placeholder for missing information', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ artist: null, album: null, year: null, genre: null }));
    player.expand();

    const wrapper = mountDock(options);
    await waitForFullView(wrapper);

    expect(wrapper.get('.player_full_artist').text()).toBe('—');
    expect(wrapper.findAll('.player_full_detail_value').map((item) => item.text())).toEqual([
      '—',
      '—',
      '—',
    ]);
  });

  it('controls playback from the bar', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    await player.playFrom(tracks, tracks[0]?.id ?? '');

    const wrapper = mountDock(options);
    await wrapper.get('[data-testid="player-next"]').trigger('click');
    await flushPromises();

    expect(player.currentTrack?.id).toBe(tracks[1]?.id);
  });

  it('shows elapsed time and current track duration', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ durationMs: 185_000 }));

    const wrapper = mountDock(options);

    expect(wrapper.get('[data-testid="player-duration"]').text()).toBe('3:05');
    expect(wrapper.get('[data-testid="player-position"]').text()).toBe('0:00');
  });

  it('warns when playback does not start', async () => {
    const options = withPinia();
    const player = usePlayerStore();
    await player.play(makeTrack({ missing: true }));

    const wrapper = mountDock(options);

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Il file di questo brano non è più presente su disco.',
    );
  });
});
