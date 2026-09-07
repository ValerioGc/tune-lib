import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import * as bridge from '@/services/mini-player-bridge';
import * as shell from '@/services/shell-integration';
import { useSettingsStore } from '@/stores/settings';

import MiniPlayerView from '@/views/MiniPlayerView.vue';

const mocks = vi.hoisted(() => ({ state: vi.fn() }));

const playing = {
  title: 'Blue in Green',
  artist: 'Miles',
  album: 'Kind of Blue',
  year: 1959,
  cover: null,
  isPlaying: true,
  hasNext: true,
  hasPrevious: false,
  position: 30,
  duration: 180,
  volume: 0.8,
  isMuted: false,
  gradient: 'linear-gradient(rgb(10 20 30 / 28%), transparent)',
};

beforeEach(() => {
  resetI18n();
  vi.restoreAllMocks();
  mocks.state.mockReset();
});

/** The dock draws what the main window tells it: the listener is answered by hand here. */
async function mountDock() {
  const options = withPinia();
  const settings = useSettingsStore();
  vi.spyOn(bridge, 'onPlayerState').mockImplementation(async (run) => {
    mocks.state.mockImplementation(run);
    return null;
  });

  const wrapper = mount(MiniPlayerView, options);
  await flushPromises();
  // The dock reads the settings of the app on its own, browser language included.
  await settings.setLocale('it');
  await flushPromises();

  return { wrapper, settings };
}

describe('MiniPlayerView', () => {
  it('draws the track the main window is playing', async () => {
    const { wrapper } = await mountDock();

    expect(wrapper.find('.mini_player_skeleton_title').exists()).toBe(true);
    expect(wrapper.get('[data-testid="mini-menu"]').attributes('disabled')).toBeUndefined();

    mocks.state(playing);
    await flushPromises();

    expect(wrapper.get('.mini_player_title').text()).toBe('Blue in Green');
    expect(wrapper.get('.mini_player_artist').text()).toBe('Miles');
    expect(wrapper.get('[data-testid="mini-toggle"]').attributes('aria-label')).toBe(
      'Metti in pausa',
    );
    expect(wrapper.get('[data-testid="mini-next"]').attributes('disabled')).toBeUndefined();
    // The colour of the cover is painted behind the dock while the setting asks for it.
    expect(wrapper.get('.mini_player').classes()).toContain('mini_player_accented');
    expect(wrapper.get('.mini_player').attributes('style')).toContain('background-image');
    expect(wrapper.get('.mini_player').attributes('style')).toContain('linear-gradient');
  });

  it('keeps the window commands on the top line, transport apart', async () => {
    const { wrapper } = await mountDock();
    const bar = wrapper.get('.mini_player_bar');

    expect(bar.find('[data-testid="mini-expand"]').exists()).toBe(true);
    expect(bar.find('[data-testid="mini-close"]').exists()).toBe(true);
    expect(bar.find('[data-testid="mini-level"]').exists()).toBe(true);
    expect(bar.find('[data-testid="mini-pin"]').exists()).toBe(true);
    expect(bar.find('[data-testid="mini-level"]').attributes('disabled')).toBeDefined();
    expect(bar.find('[data-testid="mini-expand"]').attributes('disabled')).toBeDefined();
    expect(bar.find('[data-testid="mini-close"]').attributes('disabled')).toBeUndefined();
    expect(bar.find('[data-testid="mini-toggle"]').exists()).toBe(false);
  });

  it('keeps window commands above playback in the expanded view', async () => {
    const { wrapper, settings } = await mountDock();
    mocks.state(playing);
    await flushPromises();

    settings.miniPlayerLevel = 'expanded';
    await flushPromises();

    const bar = wrapper.get('.mini_player_bar');
    const controls = wrapper.get('.mini_player_controls');

    expect(bar.find('[data-testid="mini-menu"]').exists()).toBe(true);
    expect(bar.find('[data-testid="mini-pin"]').exists()).toBe(true);
    expect(bar.find('[data-testid="mini-expand"]').exists()).toBe(true);
    expect(bar.find('[data-testid="mini-close"]').exists()).toBe(true);
    expect(controls.find('[data-testid="mini-previous"]').exists()).toBe(true);
    expect(controls.find('[data-testid="mini-next"]').exists()).toBe(true);
    expect(controls.find('[data-testid="mini-stop"]').exists()).toBe(true);
    expect(controls.find('[data-testid="mini-menu"]').exists()).toBe(false);
    expect(wrapper.get('.mini_player_album').text()).toBe('Kind of Blue');
    expect(wrapper.get('[data-testid="mini-year"]').text()).toBe('1959');
    expect(
      wrapper.get('.mini_player_playback_row').find('[data-testid="mini-mute"]').exists(),
    ).toBe(true);
    expect(wrapper.get('.mini_player_progress_area').classes()).toContain(
      'mini_player_progress_area_expanded',
    );
  });

  it('puts vertical compact audio controls beside the transport above progress', async () => {
    const { wrapper, settings } = await mountDock();
    settings.miniPlayerOrientation = 'vertical';
    settings.miniPlayerLevel = 'compact';
    mocks.state(playing);
    await flushPromises();

    expect(wrapper.get('.mini_player_track').find('[data-testid="mini-toggle"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.get('.mini_player_playback_row').find('[data-testid="mini-toggle"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('.mini_player_playback_row').find('[data-testid="mini-mute"]').exists(),
    ).toBe(true);
    expect(wrapper.get('.mini_player_progress_area').classes()).toContain(
      'mini_player_progress_area_compact',
    );
  });

  it('puts vertical expanded audio controls below progress', async () => {
    const { wrapper, settings } = await mountDock();
    settings.miniPlayerOrientation = 'vertical';
    settings.miniPlayerLevel = 'expanded';
    mocks.state(playing);
    await flushPromises();

    expect(wrapper.get('.mini_player_track').find('.mini_player_names').exists()).toBe(true);
    expect(
      wrapper.get('.mini_player_playback_row').find('[data-testid="mini-toggle"]').exists(),
    ).toBe(true);
    expect(
      wrapper.get('.mini_player_playback_row').find('[data-testid="mini-mute"]').exists(),
    ).toBe(false);
    expect(
      wrapper.get('.mini_player_sound_vertical_bottom').find('[data-testid="mini-mute"]').exists(),
    ).toBe(true);
  });

  it('holds back the second level until it is asked for', async () => {
    const { wrapper, settings } = await mountDock();

    // Nothing to play yet: the transport is a row of placeholders rather than dead buttons.
    expect(wrapper.find('[data-testid="mini-previous"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="mini-mute"]').exists()).toBe(true);

    mocks.state(playing);
    await flushPromises();

    expect(wrapper.find('[data-testid="mini-previous"]').exists()).toBe(true);
    await wrapper.get('[data-testid="mini-level"]').trigger('click');
    await flushPromises();

    expect(settings.miniPlayerLevel).toBe('expanded');
    expect(wrapper.find('[data-testid="mini-previous"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="mini-stop"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="mini-mute"]').exists()).toBe(true);
  });

  it('keeps the transport beside the track, with the bar alone under it', async () => {
    const { wrapper, settings } = await mountDock();
    settings.miniPlayerLevel = 'compact';
    mocks.state(playing);
    await flushPromises();
    const track = wrapper.get('.mini_player_track');

    // Compact: name, artist and the transport share one row.
    expect(track.find('.mini_player_names').exists()).toBe(true);
    expect(track.find('[data-testid="mini-toggle"]').exists()).toBe(true);
    expect(track.find('[data-testid="mini-next"]').exists()).toBe(true);
    expect(wrapper.find('.mini_player_progress').exists()).toBe(true);
    expect(wrapper.get('.mini_player_progress_area').classes()).toContain(
      'mini_player_progress_area_compact',
    );
    expect(
      wrapper.get('.mini_player_progress_area').find('[data-testid="mini-mute"]').exists(),
    ).toBe(true);
  });

  it('draws the progress the way the settings ask for', async () => {
    const { wrapper, settings } = await mountDock();
    mocks.state(playing);
    await flushPromises();

    expect(wrapper.get('[data-testid="player-position"]').text()).toBe('0:30');

    settings.miniPlayerProgress = 'line';
    await flushPromises();
    expect(wrapper.find('[data-testid="player-position"]').exists()).toBe(false);
    expect(wrapper.find('.mini_player_progress').exists()).toBe(true);

    settings.miniPlayerProgress = 'none';
    await flushPromises();
    expect(wrapper.find('.mini_player_progress').exists()).toBe(false);
  });

  it('asks the main window for what only it can do', async () => {
    const send = vi.spyOn(bridge, 'sendMiniCommand').mockResolvedValue(true);
    const { wrapper, settings } = await mountDock();
    settings.miniPlayerLevel = 'expanded';
    mocks.state(playing);
    await flushPromises();

    await wrapper.get('[data-testid="mini-toggle"]').trigger('click');
    await wrapper.get('[data-testid="mini-stop"]').trigger('click');
    await wrapper.get('[data-testid="mini-mute"]').trigger('click');
    await wrapper.get('[data-testid="mini-expand"]').trigger('click');

    expect(send.mock.calls.map(([action]) => action).filter((action) => action !== 'sync')).toEqual(
      ['toggle', 'stop', 'mute', 'expand'],
    );
  });

  it('keeps its commands and its layout behind the three dots', async () => {
    const send = vi.spyOn(bridge, 'sendMiniCommand').mockResolvedValue(true);
    const { wrapper, settings } = await mountDock();
    mocks.state(playing);
    await flushPromises();

    // Nothing of it is on the face of the dock until it is asked for.
    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(false);

    await wrapper.get('[data-testid="mini-menu"]').trigger('click');

    const sheet = wrapper.get('[data-testid="mini-sheet"]');

    // Audio and transport controls live on the face of the dock, not in this menu.
    expect(sheet.find('[data-testid="mini-sheet-stop"]').exists()).toBe(false);
    expect(sheet.find('[data-testid="mini-sheet-previous"]').exists()).toBe(false);
    expect(sheet.find('[data-testid="mini-sheet-mute"]').exists()).toBe(false);
    expect(sheet.find('.mini_player_sheet_volume').exists()).toBe(false);

    expect(wrapper.get('[data-testid="mini-menu"]').attributes('disabled')).toBeUndefined();

    await sheet.get('[data-testid="mini-orientation"]').trigger('click');
    expect(settings.miniPlayerOrientation).toBe('vertical');
    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(false);

    await wrapper.get('[data-testid="mini-menu"]').trigger('click');
    await wrapper.get('[data-testid="mini-settings"]').trigger('click');
    expect(send.mock.calls.map(([action]) => action).filter((action) => action !== 'sync')).toEqual(
      ['settings'],
    );
    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(false);

    expect(sheet.find('[data-testid="mini-on-top"]').exists()).toBe(false);
    await wrapper.get('[data-testid="mini-pin"]').trigger('click');
    expect(settings.miniPlayerAlwaysOnTop).toBe(false);
  });

  it('closes the three-dot menu when another part of the player is clicked', async () => {
    const { wrapper } = await mountDock();
    mocks.state(playing);
    await flushPromises();

    await wrapper.get('[data-testid="mini-menu"]').trigger('click');
    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(true);

    await wrapper.get('.mini_player_track').trigger('click');

    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(false);
  });

  it('closes the three-dot menu when an option is clicked', async () => {
    const { wrapper } = await mountDock();
    mocks.state(playing);
    await flushPromises();

    await wrapper.get('[data-testid="mini-menu"]').trigger('click');
    await wrapper.get('[data-testid="mini-settings"]').trigger('click');

    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(false);
  });

  it('closes the three-dot menu when the pin button is clicked', async () => {
    const { wrapper } = await mountDock();
    mocks.state(playing);
    await flushPromises();

    await wrapper.get('[data-testid="mini-menu"]').trigger('click');
    await wrapper.get('[data-testid="mini-pin"]').trigger('click');

    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(false);
  });

  it('closes the three-dot menu when a window view command is clicked', async () => {
    const send = vi.spyOn(bridge, 'sendMiniCommand').mockResolvedValue(true);
    const { wrapper, settings } = await mountDock();
    mocks.state(playing);
    settings.miniPlayerLevel = 'compact';
    await flushPromises();

    await wrapper.get('[data-testid="mini-menu"]').trigger('click');
    await wrapper.get('[data-testid="mini-level"]').trigger('click');
    await flushPromises();

    expect(settings.miniPlayerLevel).toBe('expanded');
    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(false);

    await wrapper.get('[data-testid="mini-menu"]').trigger('click');
    await wrapper.get('[data-testid="mini-expand"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="mini-sheet"]').exists()).toBe(false);
    expect(send).toHaveBeenCalledWith('expand');
  });

  it('leaves the cover background to the settings of the app', async () => {
    const { wrapper } = await mountDock();
    mocks.state(playing);
    await flushPromises();

    await wrapper.get('[data-testid="mini-menu"]').trigger('click');

    expect(wrapper.find('[data-testid="mini-gradient"]').exists()).toBe(false);
  });

  /** Where no window can be opened — a browser preview, these tests — the dock asks instead. */
  it('asks before closing, and can be told once and for all', async () => {
    const closeDock = vi.spyOn(shell, 'closeMiniPlayer').mockResolvedValue(true);
    vi.spyOn(shell, 'openMiniCloseConfirmation').mockResolvedValue(false);
    const { wrapper, settings } = await mountDock();
    mocks.state(playing);
    await flushPromises();

    await wrapper.get('[data-testid="mini-close"]').trigger('click');
    // The dock asks the shell first, and only draws the question once it has been told no.
    await flushPromises();
    expect(wrapper.find('[data-testid="mini-close-cancel"]').exists()).toBe(true);

    await wrapper.get('[data-testid="mini-remember"]').setValue(true);
    await wrapper.get('[data-testid="mini-close-dock"]').trigger('click');
    await flushPromises();

    expect(closeDock).toHaveBeenCalledTimes(1);
    expect(settings.miniPlayerCloseAction).toBe('dock');
  });

  it('draws placeholders until it is told what is playing', async () => {
    const { wrapper, settings } = await mountDock();
    // The layout another test left behind is read back from the same storage.
    settings.miniPlayerLevel = 'compact';
    settings.miniPlayerOrientation = 'horizontal';
    await flushPromises();

    // The picture, the two lines of writing, the three buttons and the bar with its times:
    // each one holds the room of the thing it stands in for.
    expect(wrapper.find('.mini_player_skeleton_title').exists()).toBe(true);
    expect(wrapper.find('.mini_player_skeleton_artist').exists()).toBe(true);
    expect(wrapper.get('.mini_player_cover').find('.app_skeleton_box').exists()).toBe(true);
    expect(wrapper.findAll('.app_skeleton_circle')).toHaveLength(3);
    expect(wrapper.find('.mini_player_bar_placeholder').exists()).toBe(true);
    expect(wrapper.findAll('.mini_player_time_placeholder')).toHaveLength(2);
    expect(wrapper.find('[data-testid="mini-toggle"]').exists()).toBe(false);

    mocks.state(playing);
    await flushPromises();

    expect(wrapper.find('.app_skeleton').exists()).toBe(false);
    expect(wrapper.find('[data-testid="mini-toggle"]').exists()).toBe(true);
  });

  it('stands back behind a veil while the close question is up', async () => {
    const askInAWindow = vi.spyOn(shell, 'openMiniCloseConfirmation').mockResolvedValue(true);
    const { wrapper, settings } = await mountDock();
    mocks.state(playing);
    await flushPromises();
    settings.miniPlayerCloseAction = 'ask';

    await wrapper.get('[data-testid="mini-close"]').trigger('click');
    await flushPromises();

    // The dock cannot answer the question, so it answers nothing: the only thing left to
    // click is the way back to the window that can.
    await wrapper.get('[data-testid="mini-veil"]').trigger('click');
    await flushPromises();

    expect(askInAWindow).toHaveBeenCalledTimes(2);
  });

  it('asks the question in a window of its own wherever one can be opened', async () => {
    const askInAWindow = vi.spyOn(shell, 'openMiniCloseConfirmation').mockResolvedValue(true);
    const { wrapper, settings } = await mountDock();
    mocks.state(playing);
    await flushPromises();
    // An answer remembered by another test is read back from the same storage.
    settings.miniPlayerCloseAction = 'ask';

    await wrapper.get('[data-testid="mini-close"]').trigger('click');
    await flushPromises();

    expect(askInAWindow).toHaveBeenCalledTimes(1);
    // Nothing is folded into the dock: the question, and the answer, belong to that window.
    expect(wrapper.find('[data-testid="mini-close-cancel"]').exists()).toBe(false);
  });

  it('skips the question once the answer is remembered', async () => {
    const send = vi.spyOn(bridge, 'sendMiniCommand').mockResolvedValue(true);
    const { wrapper, settings } = await mountDock();
    mocks.state(playing);
    await flushPromises();
    settings.miniPlayerCloseAction = 'app';

    await wrapper.get('[data-testid="mini-close"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('dialog').exists()).toBe(false);
    expect(send).toHaveBeenCalledWith('quit');
  });
});
