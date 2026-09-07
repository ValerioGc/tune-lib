import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  convertFileSrc: mocks.convertFileSrc,
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open, save: mocks.save }));

import {
  ShellUnavailableError,
  addTracks,
  createLibrary,
  deleteLibrary,
  exportLibrary,
  importLibrary,
  listLibraries,
  pickExportFile,
  pickImportFile,
  switchLibrary,
  coverUrl,
  heavyCoverBytes,
  libraryInfo,
  listTracks,
  pickAudioFiles,
  removeTrack,
  renameLibrary,
  verifyTrackFile,
  writeCover,
  writeMetadata,
} from '@/services/library-api';

const update = { title: 'Title', artist: 'Artist', album: null, year: 1999, genre: 'Rock' };
const metadata = { artists: [], albums: [], genres: [], artistArtwork: [], genreArtwork: [] };

const scopedWindow = window as unknown as Record<string, unknown>;

function withShell() {
  scopedWindow.__TAURI_INTERNALS__ = {};
}

beforeEach(() => {
  mocks.invoke.mockResolvedValue([]);
  mocks.open.mockResolvedValue(null);
  mocks.save.mockResolvedValue(null);
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('listTracks', () => {
  it('returns an empty list outside the shell', async () => {
    await expect(listTracks()).resolves.toEqual([]);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('calls the Rust command inside the shell', async () => {
    withShell();
    mocks.invoke.mockResolvedValue([{ id: 'a' }]);

    await expect(listTracks()).resolves.toEqual([{ id: 'a' }]);
    expect(mocks.invoke).toHaveBeenCalledWith('list_tracks');
  });
});

describe('libraryInfo', () => {
  it('uses the app name outside the shell', async () => {
    await expect(libraryInfo()).resolves.toEqual({ name: 'TuneLib', metadata });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('calls the Rust command inside the shell', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ name: 'Archive', metadata });

    await expect(libraryInfo()).resolves.toEqual({ name: 'Archive', metadata });
    expect(mocks.invoke).toHaveBeenCalledWith('library_info');
  });
});

describe('commands requiring the shell', () => {
  it('reject outside the shell', async () => {
    await expect(addTracks(['a.mp3'])).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(removeTrack('id')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(renameLibrary('Archive')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(verifyTrackFile('id')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(heavyCoverBytes('a.mp3')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(pickAudioFiles()).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(writeMetadata('id', update)).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(writeCover('id', null)).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(createLibrary('Jazz')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(switchLibrary('lib-1')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(deleteLibrary('lib-1')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(exportLibrary('lib-1', 'copy.json', 'full')).rejects.toBeInstanceOf(
      ShellUnavailableError,
    );
    await expect(importLibrary('copy.json', 'merge')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(pickExportFile('Jazz')).rejects.toBeInstanceOf(ShellUnavailableError);
    await expect(pickImportFile()).rejects.toBeInstanceOf(ShellUnavailableError);
  });

  it('forwards metadata edits', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ id: 'abc', title: 'Title' });

    await expect(writeMetadata('abc', update)).resolves.toEqual({ id: 'abc', title: 'Title' });
    expect(mocks.invoke).toHaveBeenCalledWith('write_metadata', { id: 'abc', update });
  });

  it('forwards cover writes and removal', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ id: 'abc' });
    const cover = { mimeType: 'image/png', data: 'AAA' };

    await writeCover('abc', cover);
    expect(mocks.invoke).toHaveBeenCalledWith('write_cover', { id: 'abc', cover });

    await writeCover('abc', null);
    expect(mocks.invoke).toHaveBeenLastCalledWith('write_cover', { id: 'abc', cover: null });
  });

  it('forwards paths to the import command', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ added: [], duplicates: [], failed: [] });

    await addTracks(['C:/music/track.mp3']);

    expect(mocks.invoke).toHaveBeenCalledWith('add_tracks', {
      paths: ['C:/music/track.mp3'],
    });
  });

  it('forwards the identifier to removal', async () => {
    withShell();
    mocks.invoke.mockResolvedValue(true);

    await expect(removeTrack('abc')).resolves.toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith('remove_track', { id: 'abc' });
  });

  it('forwards the library name', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ name: 'Archive', metadata });

    await expect(renameLibrary('Archive')).resolves.toEqual({ name: 'Archive', metadata });
    expect(mocks.invoke).toHaveBeenCalledWith('rename_library', { name: 'Archive' });
  });

  it('forwards verification of the tracked file', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ id: 'abc', missing: true });

    await expect(verifyTrackFile('abc')).resolves.toEqual({ id: 'abc', missing: true });
    expect(mocks.invoke).toHaveBeenCalledWith('verify_track_file', { id: 'abc' });
  });

  it('asks only why a cover is missing, never for the picture itself', async () => {
    withShell();
    mocks.invoke.mockResolvedValue(20_000_000);

    await expect(heavyCoverBytes('C:/music/track.mp3')).resolves.toBe(20_000_000);
    expect(mocks.invoke).toHaveBeenCalledWith('heavy_cover_bytes', {
      path: 'C:/music/track.mp3',
    });
  });
});

describe('pickAudioFiles', () => {
  beforeEach(withShell);

  it('returns an empty list when the user cancels', async () => {
    mocks.open.mockResolvedValue(null);

    await expect(pickAudioFiles()).resolves.toEqual([]);
  });

  it('normalizes a single selection into a list', async () => {
    mocks.open.mockResolvedValue('C:/music/track.mp3');

    await expect(pickAudioFiles()).resolves.toEqual(['C:/music/track.mp3']);
  });

  it('returns multiple selection', async () => {
    mocks.open.mockResolvedValue(['a.mp3', 'b.flac']);

    await expect(pickAudioFiles()).resolves.toEqual(['a.mp3', 'b.flac']);
  });

  it('filters the dialog to supported formats', async () => {
    await pickAudioFiles();

    expect(mocks.open).toHaveBeenCalledWith(
      expect.objectContaining({
        multiple: true,
        filters: [expect.objectContaining({ extensions: expect.arrayContaining(['mp3']) })],
      }),
    );
  });
});

describe('coverUrl', () => {
  it('addresses the cover through the shell, with the version that busts the cache', () => {
    withShell();
    mocks.convertFileSrc.mockReturnValue('cover://localhost/C%3A%2Fmusic%2Ftrack.mp3');

    expect(coverUrl('C:/music/track.mp3', 3)).toBe(
      'cover://localhost/C%3A%2Fmusic%2Ftrack.mp3?v=3',
    );
    expect(mocks.convertFileSrc).toHaveBeenCalledWith('C:/music/track.mp3', 'cover');
  });

  it('has nothing to address outside the shell', () => {
    expect(coverUrl('C:/music/track.mp3', 0)).toBe('');
  });
});

describe('library catalog', () => {
  it('knows no libraries without the shell', async () => {
    await expect(listLibraries()).resolves.toEqual([]);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('forwards list, create, open, and delete', async () => {
    withShell();
    mocks.invoke.mockResolvedValue([]);

    await listLibraries();
    await createLibrary('Jazz');
    await switchLibrary('lib-2');
    await deleteLibrary('lib-2');

    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'list_libraries');
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'create_library', { name: 'Jazz' });
    expect(mocks.invoke).toHaveBeenNthCalledWith(3, 'switch_library', { id: 'lib-2' });
    expect(mocks.invoke).toHaveBeenNthCalledWith(4, 'delete_library', { id: 'lib-2' });
  });

  it('exports to the chosen file', async () => {
    withShell();
    mocks.invoke.mockResolvedValue('C:/backup/jazz.json');

    await expect(exportLibrary('lib-2', 'C:/backup/jazz.json', 'full')).resolves.toBe(
      'C:/backup/jazz.json',
    );
    expect(mocks.invoke).toHaveBeenCalledWith('export_library', {
      id: 'lib-2',
      destination: 'C:/backup/jazz.json',
      mode: 'full',
    });
  });

  it('exports only the paths when asked to', async () => {
    withShell();
    mocks.invoke.mockResolvedValue('C:/backup/jazz.json');

    await expect(exportLibrary('lib-2', 'C:/backup/jazz.json', 'paths')).resolves.toBe(
      'C:/backup/jazz.json',
    );
    expect(mocks.invoke).toHaveBeenCalledWith('export_library', {
      id: 'lib-2',
      destination: 'C:/backup/jazz.json',
      mode: 'paths',
    });
  });

  it('imports from the chosen file with the selected strategy', async () => {
    withShell();
    mocks.invoke.mockResolvedValue({ added: 1, updated: 0, skipped: 0, missing: [], total: 1 });

    await expect(importLibrary('C:/backup/jazz.json', 'mergeSkipDuplicates')).resolves.toEqual({
      added: 1,
      updated: 0,
      skipped: 0,
      missing: [],
      total: 1,
    });
    expect(mocks.invoke).toHaveBeenCalledWith('import_library', {
      source: 'C:/backup/jazz.json',
      strategy: 'mergeSkipDuplicates',
    });
  });

  it('suggests a file name and filters the dialog to JSON', async () => {
    withShell();
    mocks.save.mockResolvedValue('C:/backup/jazz.json');

    await expect(pickExportFile('Jazz')).resolves.toBe('C:/backup/jazz.json');
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: 'Jazz.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
  });

  it('chooses a JSON file to import', async () => {
    withShell();
    mocks.open.mockResolvedValue('C:/backup/jazz.json');

    await expect(pickImportFile()).resolves.toBe('C:/backup/jazz.json');
    expect(mocks.open).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
  });

  it('normalizes unexpected multiple selections in the import picker', async () => {
    withShell();
    mocks.open.mockResolvedValue(['C:/backup/jazz.json']);

    await expect(pickImportFile()).resolves.toBe('C:/backup/jazz.json');
  });
});
