import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import MetadataField from '@/components/metadata/fields/MetadataField.vue';

describe('MetadataField', () => {
  it('links the label to the field', () => {
    const wrapper = mount(MetadataField, { props: { modelValue: '', label: 'Name' } });

    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'));
  });

  it('emits the typed value', async () => {
    const wrapper = mount(MetadataField, { props: { modelValue: '', label: 'Name' } });

    await wrapper.get('input').setValue('Track');

    expect(wrapper.emitted('update:modelValue')).toEqual([['Track']]);
  });

  it('shows autocomplete suggestions when provided', () => {
    const wrapper = mount(MetadataField, {
      props: { modelValue: '', label: 'Artist', suggestions: ['A', 'B'] },
    });

    expect(wrapper.get('input').attributes('list')).toBe(wrapper.get('datalist').attributes('id'));
    expect(wrapper.findAll('option').map((option) => option.attributes('value'))).toEqual([
      'A',
      'B',
    ]);
  });

  it('reports no errors when the field is valid', () => {
    const wrapper = mount(MetadataField, { props: { modelValue: 'Track', label: 'Name' } });

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('false');
  });

  it('announces the error and links it to the field', () => {
    const wrapper = mount(MetadataField, {
      props: { modelValue: '', label: 'Name', error: 'The name cannot be empty.' },
    });

    const alert = wrapper.get('[role="alert"]');

    expect(alert.text()).toBe('The name cannot be empty.');
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
    expect(wrapper.get('input').attributes('aria-describedby')).toBe(alert.attributes('id'));
    expect(wrapper.get('input').classes()).toContain('metadata_field_input_invalid');
  });
});
