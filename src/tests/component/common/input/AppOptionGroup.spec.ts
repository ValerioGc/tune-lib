import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppOptionGroup from '@/components/common/input/AppOptionGroup.vue';

const options = [
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
];

describe('AppOptionGroup', () => {
  it('shows the legend and one radio per option', () => {
    const wrapper = mount(AppOptionGroup, {
      props: { modelValue: 'light', options, legend: 'Tema' },
    });

    expect(wrapper.get('legend').text()).toBe('Tema');
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2);
  });

  it('marks only the current option as selected', () => {
    const wrapper = mount(AppOptionGroup, {
      props: { modelValue: 'dark', options, legend: 'Tema' },
    });

    const items = wrapper.findAll('.app_option_group_item');

    expect(items[0]?.classes()).not.toContain('app_option_group_item_selected');
    expect(items[1]?.classes()).toContain('app_option_group_item_selected');
  });

  it('groups radios under the same name', () => {
    const wrapper = mount(AppOptionGroup, {
      props: { modelValue: 'light', options, legend: 'Tema' },
    });

    const names = wrapper.findAll('input').map((input) => input.attributes('name'));

    expect(new Set(names).size).toBe(1);
  });

  it('emits the chosen value', async () => {
    const wrapper = mount(AppOptionGroup, {
      props: { modelValue: 'light', options, legend: 'Tema' },
    });

    await wrapper.findAll('input')[1]?.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toEqual([['dark']]);
  });

  it('draws the icon of an option before its label, as decoration', () => {
    const wrapper = mount(AppOptionGroup, {
      props: {
        modelValue: 'it',
        legend: 'Lingua',
        options: [
          { value: 'it', label: 'Italiano', icon: '/flag-it.svg' },
          { value: 'en', label: 'Inglese' },
        ],
      },
    });

    const items = wrapper.findAll('.app_option_group_item');
    const icon = items[0]?.get('.app_option_group_icon');

    expect(icon?.attributes('src')).toBe('/flag-it.svg');
    expect(icon?.attributes('alt')).toBe('');
    // An option without one renders nothing extra.
    expect(items[1]?.find('.app_option_group_icon').exists()).toBe(false);
  });
});
