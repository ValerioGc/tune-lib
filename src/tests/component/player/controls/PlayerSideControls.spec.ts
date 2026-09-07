import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import PlayerSideControls from '@/components/player/controls/PlayerSideControls.vue';

beforeEach(() => {
  resetI18n();
});

function mountControls(props: Partial<InstanceType<typeof PlayerSideControls>['$props']> = {}) {
  return mount(PlayerSideControls, {
    ...withPinia(),
    props: { volume: 0.5, muted: false, ...props },
  });
}

describe('PlayerSideControls', () => {
  it('stops the playback', async () => {
    const wrapper = mountControls();

    await wrapper.get('[data-testid="player-stop"]').trigger('click');

    expect(wrapper.emitted('stop')).toHaveLength(1);
  });

  it('names the stop command', () => {
    const wrapper = mountControls();

    expect(wrapper.get('[data-testid="player-stop"]').attributes('aria-label')).toBe('Interrompi');
  });

  it('reports the volume as a fraction', async () => {
    const wrapper = mountControls();
    const slider = wrapper.get('input[type="range"]');

    await slider.setValue('80');

    expect(wrapper.emitted('update:volume')).toEqual([[0.8]]);
  });

  it('shows the volume already in place', () => {
    const wrapper = mountControls({ volume: 0.25 });

    expect(wrapper.get<HTMLInputElement>('input[type="range"]').element.value).toBe('25');
  });

  it('asks for the sound to be silenced, and says so while it is', async () => {
    const wrapper = mountControls();

    await wrapper.get('[data-testid="player-mute"]').trigger('click');

    expect(wrapper.emitted('toggle-mute')).toHaveLength(1);
    expect(wrapper.get('[data-testid="player-mute"]').attributes('aria-label')).toBe(
      'Disattiva audio',
    );

    const muted = mountControls({ muted: true });

    expect(muted.get('[data-testid="player-mute"]').attributes('aria-label')).toBe(
      'Riattiva audio',
    );
    expect(muted.get('[data-testid="player-mute"]').attributes('aria-pressed')).toBe('true');
  });

  it('disables stop while the track is loading', () => {
    const wrapper = mountControls({ disabled: true });

    expect(wrapper.get('[data-testid="player-stop"]').attributes('disabled')).toBeDefined();
  });
});
