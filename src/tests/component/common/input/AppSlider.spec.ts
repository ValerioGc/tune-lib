import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n } from '@tests/support/mount';

import AppSlider from '@/components/common/input/AppSlider.vue';

beforeEach(() => {
  resetI18n();
});

describe('AppSlider', () => {
  it('exposes the requested limits', () => {
    const wrapper = mount(AppSlider, {
      props: { modelValue: 20, label: 'Volume', max: 200, step: 5 },
    });
    const field = wrapper.get('input');

    expect(field.attributes('type')).toBe('range');
    expect(field.attributes('min')).toBe('0');
    expect(field.attributes('max')).toBe('200');
    expect(field.attributes('step')).toBe('5');
    expect((field.element as HTMLInputElement).value).toBe('20');
  });

  it('emits a number, not the field text', async () => {
    const wrapper = mount(AppSlider, { props: { modelValue: 0, label: 'Volume' } });

    await wrapper.get('input').setValue('42');

    expect(wrapper.emitted('update:modelValue')).toEqual([[42]]);
  });

  it('links the label to the field and can hide it', () => {
    const visibile = mount(AppSlider, { props: { modelValue: 0, label: 'Volume' } });
    const nascosta = mount(AppSlider, {
      props: { modelValue: 0, label: 'Volume', hideLabel: true },
    });

    expect(visibile.get('label').attributes('for')).toBe(visibile.get('input').attributes('id'));
    expect(visibile.get('label').classes()).not.toContain('common_visually_hidden');
    expect(nascosta.get('label').classes()).toContain('common_visually_hidden');
  });

  it('announces a readable value when provided', () => {
    const wrapper = mount(AppSlider, {
      props: { modelValue: 30, label: 'Avanzamento', valueText: '0:30 / 3:05' },
    });

    expect(wrapper.get('input').attributes('aria-valuetext')).toBe('0:30 / 3:05');
  });

  it('does not announce anything different without text', () => {
    const wrapper = mount(AppSlider, { props: { modelValue: 30, label: 'Avanzamento' } });

    expect(wrapper.get('input').attributes('aria-valuetext')).toBeUndefined();
  });

  it('can be disabled', () => {
    const wrapper = mount(AppSlider, {
      props: { modelValue: 0, label: 'Avanzamento', disabled: true },
    });

    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
  });
});
