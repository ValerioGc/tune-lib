import type { TrackView } from '@/types/library';

/** The same song held twice, as two different files. */
export interface DuplicateGroup {
  key: string;
  title: string;
  artist: string | null;
  tracks: TrackView[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/gu, ' ');
}

/** The file name alone, without its folders and without its extension. */
function fileName(path: string): string {
  const normalized = path.replaceAll('\\', '/');
  const name = normalized.slice(normalized.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');

  return normalize(dot <= 0 ? name : name.slice(0, dot));
}

/** The keys a track answers to: two tracks sharing any of them are the same song. */
function matchKeys(track: TrackView): string[] {
  const title = normalize(track.title);
  const name = fileName(track.path);
  const keys: string[] = [];

  if (title !== '') {
    keys.push(`title:${title}\u0000${normalize(track.artist ?? '')}`);
  }

  if (name !== '') {
    keys.push(`file:${name}`);
  }

  return keys;
}

/**
 * Groups the tracks that hold the same song, whatever file they came from.
 *
 * Two things give a copy away, and either is enough: the title with its artist, which is
 * what a listener calls the same song, and the file name, since the library refuses to
 * import one file twice and the same name in two folders is a copy. The duration is left
 * out of the match and shown instead: two copies are usually encoded differently and run
 * a fraction of a second apart.
 */
export function duplicateGroups(tracks: readonly TrackView[]): DuplicateGroup[] {
  const groupOfKey = new Map<string, number>();
  const parents = tracks.map((_, index) => index);

  function rootOf(index: number): number {
    let root = index;

    while (parents[root] !== root) {
      root = parents[root] ?? root;
    }

    return root;
  }

  function join(first: number, second: number) {
    const [left, right] = [rootOf(first), rootOf(second)];

    if (left !== right) {
      parents[right] = left;
    }
  }

  tracks.forEach((track, index) => {
    for (const key of matchKeys(track)) {
      const seen = groupOfKey.get(key);

      if (seen === undefined) {
        groupOfKey.set(key, index);
      } else {
        join(seen, index);
      }
    }
  });

  const groups = new Map<number, DuplicateGroup>();

  tracks.forEach((track, index) => {
    const root = rootOf(index);
    const group = groups.get(root);

    if (group === undefined) {
      groups.set(root, {
        key: track.id,
        title: track.title,
        artist: track.artist,
        tracks: [track],
      });
      return;
    }

    group.tracks.push(track);
  });

  return [...groups.values()]
    .filter((group) => group.tracks.length > 1)
    .sort((left, right) => left.title.localeCompare(right.title));
}
