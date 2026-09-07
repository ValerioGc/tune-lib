import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppInput from '@/components/common/input/AppInput.vue';

describe('AppInput', () => {
  it('links the label to the field', () => {
    const wrapper = mount(AppInput, { props: { modelValue: '', label: 'Cerca' } });

    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'));
    expect(wrapper.get('label').text()).toBe('Cerca');
  });

  it('keeps the label accessible when hidden', () => {
    const wrapper = mount(AppInput, {
      props: { modelValue: '', label: 'Cerca', hideLabel: true },
    });

    expect(wrapper.get('label').classes()).toContain('app_input_label_hidden');
    expect(wrapper.get('label').text()).toBe('Cerca');
  });

  it('emits the typed value', async () => {
    const wrapper = mount(AppInput, { props: { modelValue: '', label: 'Cerca' } });

    await wrapper.get('input').setValue('rock');

    expect(wrapper.emitted('update:modelValue')).toEqual([['rock']]);
  });

  it('applies type and placeholder', () => {
    const wrapper = mount(AppInput, {
      props: { modelValue: '', label: 'Cerca', type: 'search', placeholder: 'Title' },
    });

    expect(wrapper.get('input').attributes('type')).toBe('search');
    expect(wrapper.get('input').attributes('placeholder')).toBe('Title');
  });
});
