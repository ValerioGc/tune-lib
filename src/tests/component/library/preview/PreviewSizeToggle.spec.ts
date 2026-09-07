import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useSettingsStore } from '@/stores/settings';

import PreviewSizeToggle from '@/components/library/preview/PreviewSizeToggle.vue';

beforeEach(() => {
  resetI18n();
});

describe('PreviewSizeToggle', () => {
  it('offers the three sizes and marks the one in use', () => {
    const options = withPinia();
    const settings = useSettingsStore();
    const wrapper = mount(PreviewSizeToggle, { ...options, props: { page: 'tracks' } });

    expect(wrapper.findAll('button')).toHaveLength(3);
    expect(
      wrapper.get(`[data-testid="preview-size-${settings.previewSizes.tracks}"]`).attributes(),
    ).toMatchObject({ 'aria-pressed': 'true' });
  });

  it('remembers the size that was chosen', async () => {
    const options = withPinia();
    const settings = useSettingsStore();

    const wrapper = mount(PreviewSizeToggle, { ...options, props: { page: 'tracks' } });
    await wrapper.get('[data-testid="preview-size-large"]').trigger('click');

    expect(settings.previewSizes.tracks).toBe('large');
    expect(wrapper.get('[data-testid="preview-size-large"]').attributes('aria-pressed')).toBe(
      'true',
    );
    expect(wrapper.get('[data-testid="preview-size-medium"]').attributes('aria-pressed')).toBe(
      'false',
    );
  });

  it('names each size for whoever cannot see the squares', () => {
    const wrapper = mount(PreviewSizeToggle, { ...withPinia(), props: { page: 'tracks' } });

    expect(wrapper.get('[data-testid="preview-size-small"]').attributes('aria-label')).toBe(
      'Anteprime piccole',
    );
  });
});
