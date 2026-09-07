import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import PlayerVolume from '@/components/player/controls/PlayerVolume.vue';

beforeEach(() => {
  resetI18n();
});

describe('PlayerVolume', () => {
  it('shows volume as a percentage', () => {
    const wrapper = mount(PlayerVolume, { ...withPinia(), props: { modelValue: 0.4 } });

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('40');
    expect(wrapper.get('input').attributes('aria-valuetext')).toBe('Volume 40%');
  });

  it('reports the value in the player scale', async () => {
    const wrapper = mount(PlayerVolume, { ...withPinia(), props: { modelValue: 1 } });

    await wrapper.get('input').setValue('25');

    expect(wrapper.emitted('update:modelValue')).toEqual([[0.25]]);
  });
});
