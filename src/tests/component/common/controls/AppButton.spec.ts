import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppButton from '@/components/common/controls/AppButton.vue';

describe('AppButton', () => {
  it('renders slot content', () => {
    const wrapper = mount(AppButton, { slots: { default: 'Aggiungi' } });

    expect(wrapper.text()).toBe('Aggiungi');
  });

  it('uses the neutral variant by default', () => {
    const wrapper = mount(AppButton);

    expect(wrapper.classes()).toContain('app_button_neutral');
    expect(wrapper.attributes('type')).toBe('button');
  });

  it('applies the requested variant', () => {
    const wrapper = mount(AppButton, { props: { variant: 'danger' } });

    expect(wrapper.classes()).toContain('app_button_danger');
  });

  it('emits click when enabled', async () => {
    const wrapper = mount(AppButton);

    await wrapper.trigger('click');

    expect(wrapper.emitted('click')).toHaveLength(1);
  });

  it('emits nothing when disabled', async () => {
    const wrapper = mount(AppButton, { props: { disabled: true } });

    await wrapper.trigger('click');

    expect(wrapper.attributes('disabled')).toBeDefined();
    expect(wrapper.emitted('click')).toBeUndefined();
  });
});
