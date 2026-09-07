import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import PlayerProgress from '@/components/player/controls/PlayerProgress.vue';

beforeEach(() => {
  resetI18n();
});

function mountProgress(position: number, duration: number) {
  return mount(PlayerProgress, { ...withPinia(), props: { position, duration } });
}

describe('PlayerProgress', () => {
  it('shows elapsed time and duration', () => {
    const wrapper = mountProgress(65, 185);

    expect(wrapper.get('[data-testid="player-position"]').text()).toBe('1:05');
    expect(wrapper.get('[data-testid="player-duration"]').text()).toBe('3:05');
  });

  it('requests the new position in seconds', async () => {
    const wrapper = mountProgress(0, 185);

    await wrapper.get('input').setValue('42');

    expect(wrapper.emitted('seek')).toEqual([[42]]);
  });

  it('uses duration as the bar limit', () => {
    const wrapper = mountProgress(10, 185);

    expect(wrapper.get('input').attributes('max')).toBe('185');
    expect(wrapper.get('input').attributes('aria-valuetext')).toBe('0:10 / 3:05');
  });

  it('does not allow seeking in a track with unknown duration', () => {
    const wrapper = mountProgress(0, 0);

    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
  });
});
