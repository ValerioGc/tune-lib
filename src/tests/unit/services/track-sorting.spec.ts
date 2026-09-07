import { describe, expect, it } from 'vitest';

import { makeTrack } from '@tests/support/tracks';
import { DEFAULT_SORT } from '@/types/library';

import { filterAndSort, filterTracks, formatDuration, sortTracks } from '@/services/track-sorting';

const tracks = [
  makeTrack({
    id: 'a',
    title: 'Zebra',
    artist: 'Verdi',
    album: 'Bianco',
    year: 1999,
    genre: 'Jazz',
  }),
  makeTrack({
    id: 'b',
    title: 'alfa',
    artist: 'Bianchi',
    album: 'Nero',
    year: 2020,
    genre: 'Rock',
  }),
  makeTrack({ id: 'c', title: 'Mezzo', artist: null, album: null, year: null, genre: null }),
];

describe('filterTracks', () => {
  it('returns everything when search is empty', () => {
    expect(filterTracks(tracks, '   ')).toHaveLength(3);
  });

  it('searches case-insensitively', () => {
    expect(filterTracks(tracks, 'ZEB').map((track) => track.id)).toEqual(['a']);
  });

  it('searches artist, album, and genre but not file paths', () => {
    expect(filterTracks(tracks, 'nero').map((track) => track.id)).toEqual(['b']);
    expect(filterTracks(tracks, 'jazz').map((track) => track.id)).toEqual(['a']);
    expect(filterTracks(tracks, 'verdi').map((track) => track.id)).toEqual(['a']);
    expect(filterTracks(tracks, 'C:/music')).toEqual([]);
  });

  it('ignores empty fields without errors', () => {
    expect(filterTracks(tracks, 'inesistente')).toEqual([]);
  });
});

describe('sortTracks', () => {
  it('sorts by title ignoring case', () => {
    const sorted = sortTracks(tracks, DEFAULT_SORT);

    expect(sorted.map((track) => track.title)).toEqual(['alfa', 'Mezzo', 'Zebra']);
  });

  it('reverses order in descending direction', () => {
    const sorted = sortTracks(tracks, { column: 'title', direction: 'desc' });

    expect(sorted.map((track) => track.title)).toEqual(['Zebra', 'Mezzo', 'alfa']);
  });

  it('sorts by artist keeping tracks without one at the bottom', () => {
    const sorted = sortTracks(tracks, { column: 'artist', direction: 'asc' });

    expect(sorted.map((track) => track.artist)).toEqual(['Bianchi', 'Verdi', null]);
  });

  it('sorts by year numerically', () => {
    const sorted = sortTracks(tracks, { column: 'year', direction: 'asc' });

    expect(sorted.map((track) => track.year)).toEqual([1999, 2020, null]);
  });

  it('sorts by duration, which the track stores in milliseconds', () => {
    const timed = [
      makeTrack({ id: 'a', title: 'Zebra', durationMs: 200_000 }),
      makeTrack({ id: 'b', title: 'alfa', durationMs: 60_000 }),
      makeTrack({ id: 'c', title: 'Mezzo', durationMs: 125_000 }),
    ];

    const sorted = sortTracks(timed, { column: 'duration', direction: 'asc' });

    expect(sorted.map((track) => track.durationMs)).toEqual([60_000, 125_000, 200_000]);
    expect(
      sortTracks(timed, { column: 'duration', direction: 'desc' }).map((track) => track.durationMs),
    ).toEqual([200_000, 125_000, 60_000]);
  });

  it('keeps empty fields at the bottom in both directions', () => {
    const ascending = sortTracks(tracks, { column: 'album', direction: 'asc' });
    const descending = sortTracks(tracks, { column: 'album', direction: 'desc' });

    expect(ascending.at(-1)?.album).toBeNull();
    expect(descending.at(-1)?.album).toBeNull();
  });

  it('does not mutate the original array', () => {
    const original = [...tracks];

    sortTracks(tracks, { column: 'year', direction: 'desc' });

    expect(tracks).toEqual(original);
  });

  it('uses the title as the tie-breaker', () => {
    const sameYear = [
      makeTrack({ title: 'Beta', year: 2001 }),
      makeTrack({ title: 'Alfa', year: 2001 }),
    ];

    const sorted = sortTracks(sameYear, { column: 'year', direction: 'asc' });

    expect(sorted.map((track) => track.title)).toEqual(['Alfa', 'Beta']);
  });
});

describe('filterAndSort', () => {
  it('filters first, then sorts', () => {
    const result = filterAndSort(tracks, 'a', { column: 'title', direction: 'asc' });

    expect(result.map((track) => track.id)).toEqual(['b', 'a']);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [1000, '0:01'],
    [65_000, '1:05'],
    [185_000, '3:05'],
    [3_600_000, '1:00:00'],
    [3_725_000, '1:02:05'],
    [-5000, '0:00'],
  ])('formatta %i ms come %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});
