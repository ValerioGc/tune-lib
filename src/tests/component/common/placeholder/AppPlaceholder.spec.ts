import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppPlaceholder from '@/components/common/placeholder/AppPlaceholder.vue';

describe('AppPlaceholder', () => {
  it('shows the given title and message', () => {
    const wrapper = mount(AppPlaceholder, {
      props: { title: 'Libreria', message: 'In arrivo' },
    });

    expect(wrapper.get('.app_placeholder_title').text()).toBe('Libreria');
    expect(wrapper.get('.app_placeholder_message').text()).toBe('In arrivo');
  });
});
