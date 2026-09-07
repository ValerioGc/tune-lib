import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import type { TrackView } from '@/types/library';

import PlayerRelatedDialog from '@/components/player/PlayerRelatedDialog.vue';

beforeEach(() => {
  resetI18n();
});

const catalog = [
  makeTrack({ id: 'a', title: 'One', artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
  makeTrack({ id: 'b', title: 'Two', artist: 'artist a', album: 'Album B', genre: 'Rock' }),
  makeTrack({ id: 'c', title: 'Three', artist: 'Artist C', album: 'Album A', genre: 'Jazz' }),
];

function mountDialog(field: 'artist' | 'album' | 'genre', value: string, tracks = catalog) {
  const options = withPinia();
  const library = useLibraryStore();
  const player = usePlayerStore();
  library.tracks = tracks as TrackView[];

  return {
    wrapper: mount(PlayerRelatedDialog, { ...options, props: { field, value } }),
    player,
  };
}

describe('PlayerRelatedDialog', () => {
  it('gathers the tracks that share the album', () => {
    const { wrapper } = mountDialog('album', 'Album A');

    expect(wrapper.findAll('.player_related_title').map((title) => title.text())).toEqual([
      'One',
      'Three',
    ]);
  });

  it('reads the artist whatever case it was tagged in', () => {
    const { wrapper } = mountDialog('artist', 'Artist A');

    expect(wrapper.findAll('.player_related_title').map((title) => title.text())).toEqual([
      'One',
      'Two',
    ]);
  });

  it('plays the chosen track with the whole group as its queue', async () => {
    const { wrapper, player } = mountDialog('genre', 'Jazz');
    const playFrom = vi.spyOn(player, 'playFrom').mockResolvedValue();

    await wrapper.get('[data-testid="related-play-c"]').trigger('click');

    const [tracks, id] = playFrom.mock.calls[0] ?? [];
    expect((tracks as TrackView[]).map((track) => track.id)).toEqual(['a', 'c']);
    expect(id).toBe('c');
  });

  it('says so when the library holds nothing else', () => {
    const { wrapper } = mountDialog('album', 'Album Z');

    expect(wrapper.get('[data-testid="related-empty"]').text()).toContain('Nessun altro brano');
  });
});
