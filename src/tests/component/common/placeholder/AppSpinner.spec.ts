import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { setI18nLocale } from '@/i18n';

import AppSpinner from '@/components/common/placeholder/AppSpinner.vue';

beforeEach(resetI18n);

describe('AppSpinner', () => {
  it('announces what is being waited for', () => {
    const wrapper = mount(AppSpinner, { ...withPinia(), props: { label: 'Loading settings' } });

    expect(wrapper.get('.app_spinner').attributes('role')).toBe('status');
    expect(wrapper.get('.app_spinner').attributes('aria-label')).toBe('Loading settings');
    expect(wrapper.text()).toBe('Loading settings');
  });

  // The ring is drawn, not written: a reader that is listening hears the label instead.
  it('keeps the ring out of the reading', () => {
    const wrapper = mount(AppSpinner, { ...withPinia(), props: { label: 'Loading' } });

    expect(wrapper.get('.app_spinner_ring').attributes('aria-hidden')).toBe('true');
  });

  it('translates its default label when the language changes', async () => {
    const wrapper = mount(AppSpinner, withPinia());
    expect(wrapper.attributes('aria-label')).toBe('Caricamento');
    setI18nLocale('en');
    await wrapper.vm.$nextTick();
    expect(wrapper.attributes('aria-label')).toBe('Loading');
  });
});
