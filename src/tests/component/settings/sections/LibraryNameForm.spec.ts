import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import * as api from '@/services/library-api';

import LibraryNameForm from '@/components/settings/sections/LibraryNameForm.vue';

vi.mock('@/services/library-api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>();

  return {
    ...actual,
    libraryInfo: vi.fn(),
    renameLibrary: vi.fn(),
  };
});

const libraryInfo = vi.mocked(api.libraryInfo);
const renameLibrary = vi.mocked(api.renameLibrary);
const metadata = { artists: [], albums: [], genres: [], artistArtwork: [], genreArtwork: [] };

beforeEach(() => {
  resetI18n();
  libraryInfo.mockResolvedValue({ name: 'TuneLib', metadata });
  renameLibrary.mockResolvedValue({ name: 'Archive', metadata });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LibraryNameForm', () => {
  it('loads the name when it is not in the store yet', async () => {
    const wrapper = mount(LibraryNameForm, withPinia());
    await flushPromises();

    expect(libraryInfo).toHaveBeenCalled();
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('TuneLib');
  });

  it('saves the name trimmed of whitespace', async () => {
    const wrapper = mount(LibraryNameForm, withPinia());
    await flushPromises();

    await wrapper.get('input').setValue('  Archive  ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(renameLibrary).toHaveBeenCalledWith('Archive');
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Archive');
  });

  it('shows validation for an empty name', async () => {
    const wrapper = mount(LibraryNameForm, withPinia());
    await flushPromises();

    await wrapper.get('input').setValue('   ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(renameLibrary).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Il nome della libreria non può essere vuoto.',
    );
  });
});
