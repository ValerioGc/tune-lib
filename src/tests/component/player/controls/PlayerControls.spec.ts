import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import PlayerControls from '@/components/player/controls/PlayerControls.vue';

beforeEach(() => {
  resetI18n();
});

function mountControls(props: Partial<InstanceType<typeof PlayerControls>['$props']> = {}) {
  return mount(PlayerControls, {
    ...withPinia(),
    props: {
      isPlaying: false,
      hasNext: true,
      isShuffleEnabled: false,
      isRepeatOneEnabled: false,
      ...props,
    },
  });
}

describe('PlayerControls', () => {
  it('emits each button command', async () => {
    const wrapper = mountControls();

    await wrapper.get('[data-testid="player-previous"]').trigger('click');
    await wrapper.get('[data-testid="player-toggle"]').trigger('click');
    await wrapper.get('[data-testid="player-next"]').trigger('click');
    await wrapper.get('[data-testid="player-shuffle"]').trigger('click');
    await wrapper.get('[data-testid="player-repeat-one"]').trigger('click');

    expect(wrapper.emitted('previous')).toHaveLength(1);
    expect(wrapper.emitted('toggle')).toHaveLength(1);
    expect(wrapper.emitted('next')).toHaveLength(1);
    expect(wrapper.emitted('toggleShuffle')).toHaveLength(1);
    expect(wrapper.emitted('toggleRepeatOne')).toHaveLength(1);
  });

  it('shows play when paused and pause when playing', async () => {
    const wrapper = mountControls();
    const pulsante = wrapper.get('[data-testid="player-toggle"]');

    expect(pulsante.attributes('aria-label')).toBe('Riproduci');
    expect(pulsante.get('.app_icon').classes()).toContain('app_icon_play');

    await wrapper.setProps({ isPlaying: true });

    expect(pulsante.attributes('aria-label')).toBe('Metti in pausa');
    expect(pulsante.get('.app_icon').classes()).toContain('app_icon_pause');
    expect(pulsante.attributes('aria-pressed')).toBe('true');
  });

  it('disables next at the end of the queue', () => {
    const wrapper = mountControls({ hasNext: false });

    expect(wrapper.get('[data-testid="player-next"]').attributes('disabled')).toBeDefined();
  });

  it('shows shuffle and repeat as active options', () => {
    const wrapper = mountControls({ isShuffleEnabled: true, isRepeatOneEnabled: true });

    expect(wrapper.get('[data-testid="player-shuffle"]').classes()).toContain(
      'player_controls_mode_active',
    );
    expect(wrapper.get('[data-testid="player-shuffle"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-testid="player-repeat-one"]').classes()).toContain(
      'player_controls_mode_active',
    );
    expect(wrapper.get('[data-testid="player-repeat-one"]').attributes('aria-pressed')).toBe(
      'true',
    );
  });

  it('keeps previous available even on the first track', () => {
    const wrapper = mountControls();

    expect(wrapper.get('[data-testid="player-previous"]').attributes('disabled')).toBeUndefined();
  });

  it('disables commands while the track is loading', () => {
    const wrapper = mountControls({ disabled: true });

    expect(wrapper.get('[data-testid="player-toggle"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="player-shuffle"]').attributes('disabled')).toBeDefined();
  });

  it('leaves stop out of the group: it is not one of the transport commands', () => {
    const wrapper = mountControls();

    expect(wrapper.find('[data-testid="player-stop"]').exists()).toBe(false);
  });

  it('reads in the transport order, with play in the middle', () => {
    const wrapper = mountControls();

    expect(wrapper.findAll('button').map((button) => button.attributes('data-testid'))).toEqual([
      'player-shuffle',
      'player-previous',
      'player-toggle',
      'player-next',
      'player-repeat-one',
    ]);
  });

  it('enlarges the targets for the full page player', () => {
    const wrapper = mountControls({ prominent: true });

    expect(wrapper.get('.player_controls').classes()).toContain('player_controls_prominent');
  });
});
