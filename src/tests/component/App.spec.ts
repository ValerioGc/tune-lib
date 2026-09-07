import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia, resetI18n } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { i18n } from '@/i18n';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

const mocks = vi.hoisted(() => ({
  startupAudioFile: vi.fn(),
  onAudioFileOpened: vi.fn(),
  playbackUrl: vi.fn(),
  createAudioEngine: vi.fn(),
  onTrayStopPlayback: vi.fn(),
  closeMiniPlayer: vi.fn(),
}));

vi.mock('@/services/playback-api', () => ({
  startupAudioFile: mocks.startupAudioFile,
  onAudioFileOpened: mocks.onAudioFileOpened,
  playbackUrl: mocks.playbackUrl,
}));

vi.mock('@/services/audio-engine', () => ({
  createAudioEngine: mocks.createAudioEngine,
}));

vi.mock('@/services/shell-integration', () => ({
  applyTrayMenu: vi.fn().mockResolvedValue(true),
  onTrayStopPlayback: mocks.onTrayStopPlayback,
  closeMiniPlayer: mocks.closeMiniPlayer,
  applyCloseToTray: vi.fn().mockResolvedValue(true),
  applyMiniPlayerShape: vi.fn().mockResolvedValue(true),
  openMiniPlayer: vi.fn().mockResolvedValue(true),
  setAutostart: vi.fn().mockResolvedValue(true),
}));

import App from '@/App.vue';

beforeEach(() => {
  resetI18n();
  vi.clearAllMocks();
  mocks.startupAudioFile.mockResolvedValue(null);
  mocks.onAudioFileOpened.mockResolvedValue(null);
  mocks.onTrayStopPlayback.mockResolvedValue(null);
  mocks.closeMiniPlayer.mockResolvedValue(true);
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
  localStorage.setItem(
    'app-settings',
    JSON.stringify({ locale: 'it', textSize: 'medium', theme: 'light' }),
  );
});

afterEach(() => {
  localStorage.clear();
});

async function mountApp() {
  const wrapper = mount(App, { global: { plugins: [createTestPinia(), i18n] } });
  await flushPromises();

  return wrapper;
}

describe('App', () => {
  it('shows the custom titlebar instead of the system one', async () => {
    const wrapper = await mountApp();

    expect(wrapper.get('.titlebar_name').text()).toBe('TuneLib');
    expect(wrapper.find('[data-testid="window-close"]').exists()).toBe(true);
  });

  // The view arrives as a chunk of its own, and the wait for it has to be allowed to
  // outlast the default limit of a test: the two were the same five seconds, so a slow first
  // compile failed the test rather than the wait.
  it('starts on the library', async () => {
    const wrapper = await mountApp();

    await vi.waitFor(() => expect(wrapper.find('.library_view').exists()).toBe(true), {
      timeout: 15000,
    });
    expect(wrapper.find('.settings_view').exists()).toBe(false);
  }, 20000);

  it('opens settings from the titlebar icon', async () => {
    const wrapper = await mountApp();

    await wrapper.get('[data-testid="open-settings"]').trigger('click');
    await vi.waitFor(
      () => {
        expect(wrapper.find('.settings_view_title').exists()).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(wrapper.get('.settings_view_title').text()).toBe('Impostazioni');
    expect(wrapper.find('.library_view').exists()).toBe(false);
  });

  it('returns to the library from the same icon', async () => {
    const wrapper = await mountApp();
    useNavigationStore().go('settings');
    await flushPromises();

    await wrapper.get('[data-testid="open-settings"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('.settings_view').exists()).toBe(false);
    await vi.waitFor(() => expect(wrapper.find('.library_view').exists()).toBe(true));
  });

  it('shows the bottom player only when something is playing', async () => {
    const wrapper = await mountApp();

    expect(wrapper.find('.player_bar').exists()).toBe(false);

    usePlayerStore().play(makeTrack({ title: 'Track' }));
    await flushPromises();

    expect(wrapper.get('.player_bar_title').text()).toBe('Track');
  });

  it('opens a startup audio file in player-only mode', async () => {
    mocks.startupAudioFile.mockResolvedValue(makeTrack({ title: 'Direct file', standalone: true }));

    const wrapper = await mountApp();
    await vi.waitFor(
      () => {
        expect(wrapper.find('.player_full_title').exists()).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(useNavigationStore().view).toBe('player');
    expect(wrapper.get('.player_full_title').text()).toBe('Direct file');
    expect(wrapper.get('[data-testid="open-library-from-player"]').text()).toContain(
      'Apri libreria',
    );

    await wrapper.get('[data-testid="open-library-from-player"]').trigger('click');
    await flushPromises();

    expect(useNavigationStore().view).toBe('library');
    await vi.waitFor(() => expect(wrapper.find('.library_view').exists()).toBe(true));
  });

  it('opens a later audio-file request in the existing instance', async () => {
    const wrapper = await mountApp();
    const openAudioFile = mocks.onAudioFileOpened.mock.calls[0]?.[0] as () => Promise<void>;

    mocks.startupAudioFile.mockResolvedValue(makeTrack({ title: 'Later file', standalone: true }));
    await openAudioFile();
    await flushPromises();

    expect(useNavigationStore().view).toBe('player');
    expect(wrapper.get('.player_full_title').text()).toBe('Later file');
  });

  it('lets go of the queue and the dock when the tray asks the playback to stop', async () => {
    const wrapper = await mountApp();
    const player = usePlayerStore();
    await player.play(makeTrack({ title: 'Track' }));
    await flushPromises();

    expect(wrapper.find('.player_bar').exists()).toBe(true);

    // The tray hands the app a callback: this is the one it would have called.
    const stopFromTray = mocks.onTrayStopPlayback.mock.calls[0]?.[0] as () => void;
    stopFromTray();
    await flushPromises();

    // Stopping from outside means being done with it: nothing left to stop, nothing on
    // screen, and the dock closed with it.
    expect(player.isActive).toBe(false);
    expect(player.isPlaying).toBe(false);
    expect(wrapper.find('.player_bar').exists()).toBe(false);
    expect(mocks.closeMiniPlayer).toHaveBeenCalled();
  });

  it('releases the system theme listener on unmount', async () => {
    const wrapper = await mountApp();
    const dispose = vi.spyOn(useSettingsStore(), 'dispose');

    wrapper.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('applies saved settings to the document', async () => {
    await mountApp();

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.lang).toBe('it');
  });
});
