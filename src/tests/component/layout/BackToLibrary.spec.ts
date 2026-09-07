import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useNavigationStore } from '@/stores/navigation';

import BackToLibrary from '@/components/layout/BackToLibrary.vue';

beforeEach(() => {
  resetI18n();
});

describe('BackToLibrary', () => {
  it('says where it leads', () => {
    const wrapper = mount(BackToLibrary, withPinia());

    expect(wrapper.text()).toContain('Torna alla libreria');
  });

  it('opens the library from any view', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    navigation.go('settings');
    const wrapper = mount(BackToLibrary, options);

    await wrapper.trigger('click');

    expect(navigation.view).toBe('library');
  });
});
