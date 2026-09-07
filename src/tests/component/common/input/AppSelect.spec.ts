import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppSelect from '@/components/common/input/AppSelect.vue';

const options = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'Inglese' },
];

describe('AppSelect', () => {
  it('shows all options with the current one selected', () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: 'en', options, label: 'Lingua' },
    });

    expect(wrapper.findAll('option')).toHaveLength(2);
    expect(wrapper.get('select').element.value).toBe('en');
  });

  it('links the label to the field tramite id', () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: 'it', options, label: 'Lingua' },
    });

    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('select').attributes('id'));
    expect(wrapper.get('label').text()).toBe('Lingua');
  });

  it('emits the new value on selection', async () => {
    const wrapper = mount(AppSelect, {
      props: { modelValue: 'it', options, label: 'Lingua' },
    });

    await wrapper.get('select').setValue('en');

    expect(wrapper.emitted('update:modelValue')).toEqual([['en']]);
  });
});
