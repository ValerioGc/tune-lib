import type { TrackView } from '@/types/library';

let sequence = 0;

export function makeTrack(overrides: Partial<TrackView> = {}): TrackView {
  sequence += 1;

  return {
    id: `id-${sequence}`,
    path: `C:/music/track-${sequence}.mp3`,
    title: `Track ${sequence}`,
    artist: 'Artist',
    album: 'Album',
    year: 2000,
    genre: 'Rock',
    durationMs: 185_000,
    format: 'mp3',
    hasCover: false,
    addedAt: 1_700_000_000,
    missing: false,
    ...overrides,
  };
}

export function makeTracks(count: number): TrackView[] {
  return Array.from({ length: count }, () => makeTrack());
}
