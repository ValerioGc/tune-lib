import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import GenreSelect from '@/components/metadata/fields/GenreSelect.vue';

const props = {
  modelValue: 'Rock',
  label: 'Genere',
  customLabel: 'Scegli o scrivi',
  genres: ['Jazz', 'Rock'],
};

describe('GenreSelect', () => {
  it('suggests the library genres', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.findAll('datalist option').map((option) => option.attributes('value'))).toEqual([
      'Jazz',
      'Rock',
    ]);
  });

  it('links the field to the suggestions list', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.get('input').attributes('list')).toBe(wrapper.get('datalist').attributes('id'));
  });

  it('shows the current genre', () => {
    const wrapper = mount(GenreSelect, { props });

    expect(wrapper.get('input').element.value).toBe('Rock');
  });

  it('accepts a genre not present in the list', async () => {
    const wrapper = mount(GenreSelect, { props });

    await wrapper.get('input').setValue('Shoegaze');

    expect(wrapper.emitted('update:modelValue')).toEqual([['Shoegaze']]);
  });
});
