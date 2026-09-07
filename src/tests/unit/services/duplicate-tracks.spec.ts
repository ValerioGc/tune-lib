import { describe, expect, it } from 'vitest';

import { makeTrack } from '@tests/support/tracks';

import { duplicateGroups } from '@/services/duplicate-tracks';

describe('duplicateGroups', () => {
  it('gathers the same song held in two files', () => {
    const groups = duplicateGroups([
      makeTrack({ id: 'a', title: 'Blue in Green', artist: 'Miles', path: 'C:/a.mp3' }),
      makeTrack({ id: 'b', title: '  blue  in green ', artist: 'MILES', path: 'C:/b.flac' }),
      makeTrack({ id: 'c', title: 'So What', artist: 'Miles', path: 'C:/c.mp3' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('Blue in Green');
    expect(groups[0]?.tracks.map((track) => track.id)).toEqual(['a', 'b']);
  });

  it('keeps apart two songs that only share a title', () => {
    const groups = duplicateGroups([
      makeTrack({ id: 'a', title: 'Adagio', artist: 'Albinoni' }),
      makeTrack({ id: 'b', title: 'Adagio', artist: 'Barber' }),
    ]);

    expect(groups).toHaveLength(0);
  });

  it('matches whatever the file weighs: the encoding is not the song', () => {
    const groups = duplicateGroups([
      makeTrack({ id: 'a', title: 'Song', artist: 'Artist', format: 'mp3', durationMs: 180_000 }),
      makeTrack({ id: 'b', title: 'Song', artist: 'Artist', format: 'flac', durationMs: 181_400 }),
    ]);

    expect(groups[0]?.tracks.map((track) => track.format)).toEqual(['mp3', 'flac']);
  });

  it('leaves out a track with no title to match on', () => {
    const groups = duplicateGroups([
      makeTrack({ id: 'a', title: '   ', artist: 'Artist' }),
      makeTrack({ id: 'b', title: '', artist: 'Artist' }),
    ]);

    expect(groups).toHaveLength(0);
  });

  it('gathers the same file name held in two folders', () => {
    const groups = duplicateGroups([
      makeTrack({ id: 'a', title: 'Track one', path: 'C:/music/song 01.mp3' }),
      makeTrack({ id: 'b', title: 'Untitled', path: 'D:/backup/Song 01.flac' }),
    ]);

    // Different tags, same file: the library never imports one file twice, so the same
    // name in two folders is a copy.
    expect(groups).toHaveLength(1);
    expect(groups[0]?.tracks.map((track) => track.id)).toEqual(['a', 'b']);
  });

  it('joins copies that meet through a third one', () => {
    const groups = duplicateGroups([
      makeTrack({ id: 'a', title: 'Song', artist: 'Artist', path: 'C:/one.mp3' }),
      makeTrack({ id: 'b', title: 'Song', artist: 'Artist', path: 'C:/two.mp3' }),
      makeTrack({ id: 'c', title: 'Other name', artist: 'Other', path: 'D:/two.flac' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.tracks.map((track) => track.id)).toEqual(['a', 'b', 'c']);
  });

  it('leaves alone a file name that says nothing, once the tags differ', () => {
    const groups = duplicateGroups([
      makeTrack({ id: 'a', title: 'Adagio', artist: 'Albinoni', path: 'C:/albinoni.mp3' }),
      makeTrack({ id: 'b', title: 'Adagio', artist: 'Barber', path: 'C:/barber.mp3' }),
    ]);

    expect(groups).toHaveLength(0);
  });
});
