import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import type { TrackView } from '@/types/library';

import LibraryDuplicatesDialog from '@/components/library/dialogs/LibraryDuplicatesDialog.vue';

beforeEach(() => {
  resetI18n();
});

function mountDialog(tracks: TrackView[]) {
  const options = withPinia();
  const library = useLibraryStore();
  library.tracks = tracks;

  return {
    wrapper: mount(LibraryDuplicatesDialog, { ...options, props: { open: true } }),
    library,
  };
}

describe('LibraryDuplicatesDialog', () => {
  it('lists every copy of a song, with the file it came from', () => {
    const { wrapper } = mountDialog([
      makeTrack({ id: 'a', title: 'Song', artist: 'Artist', path: 'C:/music/a.mp3' }),
      makeTrack({ id: 'b', title: 'Song', artist: 'Artist', path: 'C:/music/b.flac' }),
      makeTrack({ id: 'c', title: 'Alone', artist: 'Artist' }),
    ]);

    expect(wrapper.findAll('.library_duplicates_group')).toHaveLength(1);
    expect(wrapper.get('.library_duplicates_count').text()).toBe('2 copie');
    expect(wrapper.findAll('.library_duplicates_path').map((path) => path.text())).toEqual([
      'C:/music/a.mp3',
      'C:/music/b.flac',
    ]);
  });

  it('says so when there is nothing held twice', () => {
    const { wrapper } = mountDialog([makeTrack({ title: 'Song' })]);

    expect(wrapper.get('[data-testid="duplicates-empty"]').text()).toContain('Nessun brano');
    expect(wrapper.findAll('.library_duplicates_group')).toHaveLength(0);
  });

  it('removes the copy it was asked for, leaving the file on disk', async () => {
    const { wrapper, library } = mountDialog([
      makeTrack({ id: 'a', title: 'Song', artist: 'Artist' }),
      makeTrack({ id: 'b', title: 'Song', artist: 'Artist' }),
    ]);
    const remove = vi.spyOn(library, 'remove').mockResolvedValue();

    await wrapper.findAll('[data-testid="duplicate-remove"]')[1]?.trigger('click');

    expect(remove).toHaveBeenCalledWith('b');
    expect(wrapper.get('.library_duplicates_description').text()).toContain('resta sul disco');
  });

  it('marks a copy whose file is already gone', async () => {
    const { wrapper } = mountDialog([
      makeTrack({ id: 'a', title: 'Song', artist: 'Artist', path: 'C:/one.mp3' }),
      makeTrack({ id: 'b', title: 'Song', artist: 'Artist', path: 'C:/two.mp3', missing: true }),
    ]);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="duplicate-missing-a"]').exists()).toBe(false);

    const marked = wrapper.get('[data-testid="duplicate-missing-b"]');

    expect(marked.attributes('aria-label')).toBe('File non più presente su disco');
    expect(wrapper.get('[data-testid="duplicate-b"]').classes()).toContain(
      'library_duplicates_file_missing',
    );
  });
});
