import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useLibraryStore } from '@/stores/library';

import LibraryCreateForm from '@/components/settings/sections/LibraryCreateForm.vue';

beforeEach(() => {
  resetI18n();
});

function mountForm() {
  const options = withPinia();
  const library = useLibraryStore();
  vi.spyOn(library, 'loadLibraries').mockResolvedValue();

  return { wrapper: mount(LibraryCreateForm, options), library };
}

describe('LibraryCreateForm', () => {
  it('stops the field before the name gets absurd', () => {
    const wrapper = mount(LibraryCreateForm, withPinia());

    expect(wrapper.get('input').attributes('maxlength')).toBe('120');
  });

  it('offers nothing to create until the field holds a name', async () => {
    const { wrapper } = mountForm();
    const button = wrapper.get('[data-testid="create-library"]');

    expect(button.attributes('disabled')).toBeDefined();

    // Spaces are not a name: the shell refuses them, and so does the button.
    await wrapper.get('input').setValue('   ');
    expect(button.attributes('disabled')).toBeDefined();

    await wrapper.get('input').setValue('Soundtracks');
    expect(button.attributes('disabled')).toBeUndefined();
  });

  it('refuses a name another library already answers to', async () => {
    const { wrapper, library } = mountForm();
    library.libraries = [{ id: 'lib-1', name: 'Jazz', trackCount: 0, active: true }];

    // Neither the case nor the spaces make it a different library.
    await wrapper.get('input').setValue('  jazz ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe('Esiste già una libreria con questo nome.');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('  jazz ');
  });

  it('takes the complaint back as soon as the name is changed', async () => {
    const { wrapper, library } = mountForm();
    library.libraries = [{ id: 'lib-1', name: 'Jazz', trackCount: 0, active: true }];

    await wrapper.get('input').setValue('Jazz');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);

    await wrapper.get('input').setValue('Jazz manouche');

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('creates a library and clears the field', async () => {
    const { wrapper, library } = mountForm();
    const createLibrary = vi.spyOn(library, 'createLibrary').mockResolvedValue(true);

    await wrapper.get('input').setValue('Soundtracks');
    await wrapper.get('form').trigger('submit');

    expect(createLibrary).toHaveBeenCalledWith('Soundtracks');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
  });

  it('keeps the name when creation fails', async () => {
    const { wrapper, library } = mountForm();
    vi.spyOn(library, 'createLibrary').mockResolvedValue(false);

    await wrapper.get('input').setValue('Soundtracks');
    await wrapper.get('form').trigger('submit');

    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Soundtracks');
  });
});
