import { flushPromises } from '@vue/test-utils';
import { setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import * as api from '@/services/library-api';
import { ShellUnavailableError } from '@/services/library-api';
import type { AddReport } from '@/types/library';

import { useLibraryStore } from '@/stores/library';

vi.mock('@/services/library-api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>();

  return {
    ...actual,
    libraryInfo: vi.fn(),
    renameLibrary: vi.fn(),
    listLibraries: vi.fn(),
    createLibrary: vi.fn(),
    switchLibrary: vi.fn(),
    deleteLibrary: vi.fn(),
    exportLibrary: vi.fn(),
    exportTrackList: vi.fn(),
    importLibrary: vi.fn(),
    pickExportFile: vi.fn(),
    pickTrackListExportFile: vi.fn(),
    pickImportFile: vi.fn(),
    listTracks: vi.fn(),
    refreshLibraryFromDisk: vi.fn(),
    refreshTrack: vi.fn(),
    addTracks: vi.fn(),
    onImportProgress: vi.fn(),
    removeTrack: vi.fn(),
    verifyTrackFile: vi.fn(),
    coverUrl: vi.fn(),
    heavyCoverBytes: vi.fn(),
    pickAudioFiles: vi.fn(),
    writeMetadata: vi.fn(),
    writeCover: vi.fn(),
  };
});

const libraryInfo = vi.mocked(api.libraryInfo);
const renameLibrary = vi.mocked(api.renameLibrary);
const listLibraries = vi.mocked(api.listLibraries);
const createLibrary = vi.mocked(api.createLibrary);
const switchLibrary = vi.mocked(api.switchLibrary);
const deleteLibrary = vi.mocked(api.deleteLibrary);
const exportLibrary = vi.mocked(api.exportLibrary);
const exportTrackList = vi.mocked(api.exportTrackList);
const importLibrary = vi.mocked(api.importLibrary);
const pickExportFile = vi.mocked(api.pickExportFile);
const pickTrackListExportFile = vi.mocked(api.pickTrackListExportFile);
const pickImportFile = vi.mocked(api.pickImportFile);
const listTracks = vi.mocked(api.listTracks);
const refreshLibraryFromDisk = vi.mocked(api.refreshLibraryFromDisk);
const refreshTrack = vi.mocked(api.refreshTrack);
const addTracks = vi.mocked(api.addTracks);
const onImportProgress = vi.mocked(api.onImportProgress);
const removeTrack = vi.mocked(api.removeTrack);
const verifyTrackFile = vi.mocked(api.verifyTrackFile);
const coverUrl = vi.mocked(api.coverUrl);
const heavyCoverBytes = vi.mocked(api.heavyCoverBytes);
const pickAudioFiles = vi.mocked(api.pickAudioFiles);
const writeMetadata = vi.mocked(api.writeMetadata);
const writeCover = vi.mocked(api.writeCover);

const emptyReport: AddReport = { added: [], duplicates: [], failed: [] };
const metadata = { artists: [], albums: [], genres: [], artistArtwork: [], genreArtwork: [] };

beforeEach(() => {
  setActivePinia(createTestPinia());
  libraryInfo.mockResolvedValue({ name: 'TuneLib', metadata });
  renameLibrary.mockResolvedValue({ name: 'Archive', metadata });
  listTracks.mockResolvedValue([]);
  refreshLibraryFromDisk.mockResolvedValue({ refreshed: 0, missing: [] });
  refreshTrack.mockResolvedValue(null);
  addTracks.mockResolvedValue(emptyReport);
  onImportProgress.mockResolvedValue(null);
  removeTrack.mockResolvedValue(true);
  verifyTrackFile.mockImplementation(async (id: string) => makeTrack({ id }));
  heavyCoverBytes.mockResolvedValue(null);
  coverUrl.mockReturnValue('cover://localhost/track.mp3?v=0');
  pickAudioFiles.mockResolvedValue([]);
  listLibraries.mockResolvedValue([]);
  importLibrary.mockResolvedValue({ added: 0, updated: 0, skipped: 0, missing: [], total: 0 });
  pickImportFile.mockResolvedValue(null);
  pickTrackListExportFile.mockResolvedValue(null);
});

const catalog = [
  { id: 'lib-1', name: 'Main', trackCount: 2, active: true },
  { id: 'lib-2', name: 'Jazz', trackCount: 0, active: false },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe('loading', () => {
  it('starts empty and without errors', () => {
    const store = useLibraryStore();

    expect(store.isEmpty).toBe(true);
    expect(store.errorKey).toBeNull();
  });

  it('has read nothing until the first read answers', async () => {
    const store = useLibraryStore();
    listTracks.mockResolvedValue([]);

    expect(store.isReady).toBe(false);

    await store.load();

    expect(store.isReady).toBe(true);
  });

  it('counts a refusal as an answer, so the wait ends', async () => {
    const store = useLibraryStore();
    listTracks.mockRejectedValue(new Error('nope'));

    await store.load();

    expect(store.isReady).toBe(true);
    expect(store.errorKey).not.toBeNull();
  });

  it('loads tracks from the backend', async () => {
    const store = useLibraryStore();
    listTracks.mockResolvedValue([makeTrack(), makeTrack()]);

    await store.load();

    expect(store.tracks).toHaveLength(2);
    expect(store.isLoading).toBe(false);
  });

  it('loads the library name from the backend', async () => {
    const store = useLibraryStore();
    libraryInfo.mockResolvedValue({ name: 'Jazz Archive', metadata });

    await store.load();

    expect(store.libraryName).toBe('Jazz Archive');
  });

  it('reports the missing desktop shell', async () => {
    const store = useLibraryStore();
    listTracks.mockRejectedValue(new ShellUnavailableError());

    await store.load();

    expect(store.errorKey).toBe('shellUnavailable');
  });

  it('reports a generic error', async () => {
    const store = useLibraryStore();
    listTracks.mockRejectedValue(new Error('boom'));

    await store.load();

    expect(store.errorKey).toBe('generic');
  });
});

describe('rename', () => {
  it('saves the name trimmed of whitespace', async () => {
    const store = useLibraryStore();

    await expect(store.renameLibrary('  Archive  ')).resolves.toBe(true);

    expect(renameLibrary).toHaveBeenCalledWith('Archive');
    expect(store.libraryName).toBe('Archive');
    expect(store.isRenaming).toBe(false);
  });

  it('rejects an empty name without calling the backend', async () => {
    const store = useLibraryStore();

    await expect(store.renameLibrary('   ')).resolves.toBe(false);

    expect(renameLibrary).not.toHaveBeenCalled();
    expect(store.errorKey).toBe('invalidLibraryName');
  });

  it('keeps the current name if the backend fails', async () => {
    const store = useLibraryStore();
    store.libraryName = 'Archive';
    renameLibrary.mockRejectedValue(new Error('boom'));

    await expect(store.renameLibrary('New')).resolves.toBe(false);

    expect(store.libraryName).toBe('Archive');
    expect(store.errorKey).toBe('generic');
  });
});

describe('import', () => {
  it('does not call the backend without paths', async () => {
    const store = useLibraryStore();

    await expect(store.addPaths([])).resolves.toBeNull();
    expect(addTracks).not.toHaveBeenCalled();
  });

  it('imports and reloads the list', async () => {
    const store = useLibraryStore();
    const added = makeTrack();
    addTracks.mockResolvedValue({ added: [added], duplicates: [], failed: [] });
    listTracks.mockResolvedValue([{ ...added, missing: false }]);

    const report = await store.addPaths([added.path]);

    expect(report?.added).toHaveLength(1);
    expect(store.tracks).toHaveLength(1);
    expect(store.isImporting).toBe(false);
  });

  it('follows the import while it runs, and lets go of it after', async () => {
    const store = useLibraryStore();
    const stopFollowing = vi.fn();
    let report: ((progress: api.ImportProgress) => void) | null = null;
    onImportProgress.mockImplementation(async (run) => {
      report = run;

      return stopFollowing;
    });

    addTracks.mockImplementation(async () => {
      // Walking the folders: the files are not counted yet, so there is no share to give.
      report?.({ done: 0, total: 0 });
      expect(store.importPercent).toBeNull();

      report?.({ done: 3, total: 8 });
      expect(store.importPercent).toBe(30);

      report?.({ done: 8, total: 8 });
      expect(store.importPercent).toBe(80);
      report?.({ done: 2, total: 8 });
      expect(store.importPercent).toBe(80);
      report?.({ done: 8, total: 8, finalizing: true });
      expect(store.importPercent).toBe(90);
      report?.({ done: 7, total: 8 });
      expect(store.importPercent).toBe(90);

      return emptyReport;
    });

    listTracks.mockImplementationOnce(async () => {
      expect(store.isImporting).toBe(true);
      expect(store.isImportRefreshing).toBe(true);
      expect(store.importPercent).toBe(95);
      return [];
    });
    await store.addPaths(['C:/music']);

    expect(stopFollowing).toHaveBeenCalledTimes(1);
    expect(store.importPercent).toBeNull();
    expect(store.isImporting).toBe(false);
  });

  it('lets go of the import even when it fails', async () => {
    const store = useLibraryStore();
    const stopFollowing = vi.fn();
    onImportProgress.mockResolvedValue(stopFollowing);
    addTracks.mockRejectedValue(new Error('boom'));

    await store.addPaths(['C:/music']);

    expect(stopFollowing).toHaveBeenCalledTimes(1);
    expect(store.importPercent).toBeNull();
  });

  it('keeps the result with duplicates and skipped files', async () => {
    const store = useLibraryStore();
    addTracks.mockResolvedValue({
      added: [],
      duplicates: ['C:/music/gia-presente.mp3'],
      failed: [{ path: 'C:/music/rotto.mp3', reason: 'unreadable audio file' }],
    });

    await store.addPaths(['C:/music/gia-presente.mp3', 'C:/music/rotto.mp3']);

    expect(store.lastReport?.duplicates).toHaveLength(1);
    expect(store.lastReport?.failed).toHaveLength(1);

    store.dismissReport();
    expect(store.lastReport).toBeNull();
  });

  it('records the import error', async () => {
    const store = useLibraryStore();
    addTracks.mockRejectedValue(new Error('boom'));

    await expect(store.addPaths(['a.mp3'])).resolves.toBeNull();
    expect(store.errorKey).toBe('generic');
    expect(store.isImporting).toBe(false);
  });

  it('imports files chosen from the system dialog', async () => {
    const store = useLibraryStore();
    pickAudioFiles.mockResolvedValue(['C:/music/track.mp3']);

    await store.pickAndAdd();

    expect(addTracks).toHaveBeenCalledWith(['C:/music/track.mp3']);
  });

  it('does nothing if the dialog is cancelled', async () => {
    const store = useLibraryStore();

    await expect(store.pickAndAdd()).resolves.toBeNull();
    expect(addTracks).not.toHaveBeenCalled();
  });

  it('reports the dialog unavailable outside the shell', async () => {
    const store = useLibraryStore();
    pickAudioFiles.mockRejectedValue(new ShellUnavailableError());

    await store.pickAndAdd();

    expect(store.errorKey).toBe('shellUnavailable');
  });
});

describe('removal', () => {
  it('removes the track from the list without reloading everything', async () => {
    const store = useLibraryStore();
    const [first, second] = [makeTrack(), makeTrack()];
    listTracks.mockResolvedValue([first, second]);
    await store.load();

    store.select(first.id);
    await store.remove(first.id);

    expect(store.tracks.map((track) => track.id)).toEqual([second.id]);
    expect(store.selectedId).toBeNull();
    expect(removeTrack).toHaveBeenCalledWith(first.id);
  });

  it('keeps multiple selected tracks and drops removed ids', async () => {
    const store = useLibraryStore();
    const [first, second, third] = [makeTrack(), makeTrack(), makeTrack()];
    listTracks.mockResolvedValue([first, second, third]);
    await store.load();

    store.setSelected([first.id, second.id]);
    store.toggleSelected(third.id);
    await store.remove(second.id);

    expect(store.selectedIds).toEqual([first.id, third.id]);
    expect(store.selectedTracks.map((track) => track.id)).toEqual([first.id, third.id]);
    expect(store.selectedId).toBe(third.id);
  });

  it('updates metadata suggestions when tracks are removed', async () => {
    const store = useLibraryStore();
    const first = makeTrack({ artist: 'Artist A', album: 'Album A', genre: 'Jazz' });
    const second = makeTrack({ artist: 'Artist B', album: 'Album B', genre: 'Rock' });
    listTracks.mockResolvedValue([first, second]);
    await store.load();

    expect(store.artistSuggestions).toEqual(['Artist A', 'Artist B']);
    expect(store.albumSuggestions).toEqual(['Album A', 'Album B']);
    expect(store.genreSuggestions).toEqual(['Jazz', 'Rock']);

    await store.remove(first.id);

    expect(store.artistSuggestions).toEqual(['Artist B']);
    expect(store.albumSuggestions).toEqual(['Album B']);
    expect(store.genreSuggestions).toEqual(['Rock']);
  });

  it('keeps the list if the backend fails', async () => {
    const store = useLibraryStore();
    const track = makeTrack();
    listTracks.mockResolvedValue([track]);
    await store.load();
    removeTrack.mockRejectedValue(new Error('boom'));

    await store.remove(track.id);

    expect(store.tracks).toHaveLength(1);
    expect(store.errorKey).toBe('generic');
  });
});

describe('link verification', () => {
  it('updates the disk status of the verified track', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ missing: false });
    listTracks.mockResolvedValue([track]);
    await store.load();
    verifyTrackFile.mockResolvedValue({ ...track, missing: true });

    const verified = await store.verifyTrack(track);

    expect(verifyTrackFile).toHaveBeenCalledWith(track.id);
    expect(verified?.missing).toBe(true);
    expect(store.tracks[0]?.missing).toBe(true);
  });

  it('reports the error without changing the list', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ missing: false });
    listTracks.mockResolvedValue([track]);
    await store.load();
    verifyTrackFile.mockRejectedValue(new Error('boom'));

    await expect(store.verifyTrack(track)).resolves.toBeNull();

    expect(store.tracks[0]?.missing).toBe(false);
    expect(store.errorKey).toBe('generic');
  });

  it('bulk verifies every track and saves the summary', async () => {
    const store = useLibraryStore();
    const [present, missing] = [makeTrack({ missing: false }), makeTrack({ missing: false })];
    listTracks.mockResolvedValue([present, missing]);
    await store.load();
    verifyTrackFile.mockImplementation(async (id: string) =>
      id === missing.id ? { ...missing, missing: true } : { ...present, missing: false },
    );

    const report = await store.verifyAllTracks();

    expect(verifyTrackFile).toHaveBeenCalledWith(present.id);
    expect(verifyTrackFile).toHaveBeenCalledWith(missing.id);
    expect(report).toEqual({ total: 2, missing: 1 });
    expect(store.lastVerification).toEqual({ total: 2, missing: 1 });
    expect(store.tracks.find((track) => track.id === missing.id)?.missing).toBe(true);
    expect(store.isVerifying).toBe(false);

    store.dismissVerification();
    expect(store.lastVerification).toBeNull();
  });
});

describe('search and sorting', () => {
  it('filters the visible list', async () => {
    const store = useLibraryStore();
    listTracks.mockResolvedValue([makeTrack({ title: 'Alfa' }), makeTrack({ title: 'Beta' })]);
    await store.load();

    store.setQuery('alf');

    expect(store.visibleTracks.map((track) => track.title)).toEqual(['Alfa']);
    expect(store.hasNoMatches).toBe(false);

    store.setQuery('nessuno');
    expect(store.hasNoMatches).toBe(true);
  });

  it('reverses direction when clicking the same column again', () => {
    const store = useLibraryStore();

    store.toggleSort('title');
    expect(store.sort).toEqual({ column: 'title', direction: 'desc' });

    store.toggleSort('title');
    expect(store.sort).toEqual({ column: 'title', direction: 'asc' });
  });

  it('restarts from ascending when changing column', () => {
    const store = useLibraryStore();
    store.toggleSort('title');

    store.toggleSort('album');

    expect(store.sort).toEqual({ column: 'album', direction: 'asc' });
  });

  it('counts files no longer present on disk', async () => {
    const store = useLibraryStore();
    listTracks.mockResolvedValue([makeTrack({ missing: true }), makeTrack()]);

    await store.load();

    expect(store.missingCount).toBe(1);
  });

  it('filters tracks by missing information', async () => {
    const store = useLibraryStore();
    listTracks.mockResolvedValue([
      makeTrack({ title: 'Without cover', hasCover: false }),
      makeTrack({ title: 'Without artist', hasCover: true, artist: null }),
      makeTrack({ title: 'Complete', hasCover: true }),
    ]);
    await store.load();

    store.setMissingInfoFilter('cover');
    expect(store.visibleTracks.map((track) => track.title)).toEqual(['Without cover']);

    store.setMissingInfoFilter('artist');
    expect(store.visibleTracks.map((track) => track.title)).toEqual(['Without artist']);

    store.setMissingInfoFilter('all');
    expect(store.visibleTracks).toHaveLength(3);
  });
});

describe('metadata editing', () => {
  it('replaces the edited track while preserving disk status', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ title: 'Old', missing: true });
    listTracks.mockResolvedValue([track]);
    await store.load();

    const { missing: _missing, ...saved } = { ...track, title: 'New' };
    writeMetadata.mockResolvedValue(saved);

    const result = await store.saveMetadata(track.id, {
      title: 'New',
      artist: null,
      album: null,
      year: null,
      genre: null,
    });

    expect(result?.title).toBe('New');
    expect(store.tracks[0]?.title).toBe('New');
    expect(store.tracks[0]?.missing).toBe(true);
    expect(store.isSaving).toBe(false);
  });

  it('invalidates cached cover after an edit', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ hasCover: true });
    listTracks.mockResolvedValue([track]);
    await store.load();
    coverUrl.mockImplementation((path, version) => `cover://localhost/${path}?v=${version}`);
    const before = store.coverUrl(track);

    const { missing: _missing, ...saved } = track;
    writeCover.mockResolvedValue(saved);
    await store.saveCover(track.id, { mimeType: 'image/png', data: 'BBB' });

    // Same file, so the same address: only the version tells the webview to fetch again.
    expect(store.coverUrl(track)).not.toBe(before);
  });

  it('reports the write error without changing the list', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ title: 'Untouched' });
    listTracks.mockResolvedValue([track]);
    await store.load();
    writeMetadata.mockRejectedValue(new Error('read only'));

    const result = await store.saveMetadata(track.id, {
      title: 'New',
      artist: null,
      album: null,
      year: null,
      genre: null,
    });

    expect(result).toBeNull();
    expect(store.errorKey).toBe('generic');
    expect(store.tracks[0]?.title).toBe('Untouched');
    expect(store.isSaving).toBe(false);
  });

  it('opens and closes the editor on the selected track, reading its file first', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ title: 'Stale' });
    listTracks.mockResolvedValue([track]);
    await store.load();
    refreshTrack.mockResolvedValue({ ...track, title: 'Edited outside' });

    expect(store.editingTrack).toBeNull();

    await store.openEditor(track.id);

    // Another program may have written to the file: the editor starts from what it says now.
    expect(refreshTrack).toHaveBeenCalledWith(track.id);
    expect(store.editingTrack?.id).toBe(track.id);
    expect(store.editingTrack?.title).toBe('Edited outside');

    store.closeEditor();
    expect(store.editingTrack).toBeNull();
  });

  it('keeps the entry it has when a file cannot be read again', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ title: 'Known' });
    listTracks.mockResolvedValue([track]);
    await store.load();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    refreshTrack.mockRejectedValue(new Error('file busy'));

    expect(await store.refreshTrack(track.id)).toEqual(track);
    expect(store.tracks[0]?.title).toBe('Known');
  });
});

describe('covers', () => {
  it('has no address for a track that carries no picture', () => {
    const store = useLibraryStore();

    expect(store.coverUrl(makeTrack({ hasCover: false }))).toBeNull();
    expect(coverUrl).not.toHaveBeenCalled();
  });

  it('has no address for a file that is not there', () => {
    const store = useLibraryStore();

    expect(store.coverUrl(makeTrack({ hasCover: true, missing: true }))).toBeNull();
    expect(coverUrl).not.toHaveBeenCalled();
  });

  it('addresses the picture without calling the shell', () => {
    const store = useLibraryStore();
    coverUrl.mockReturnValue('cover://localhost/track.mp3?v=0');

    const track = makeTrack({ hasCover: true });

    expect(store.coverUrl(track)).toBe('cover://localhost/track.mp3?v=0');
    expect(coverUrl).toHaveBeenCalledWith(track.path, 0);
  });

  it('asks the shell why a picture is missing, and survives no answer', async () => {
    const store = useLibraryStore();
    const track = makeTrack({ hasCover: true });
    heavyCoverBytes.mockResolvedValue(20_000_000);

    await expect(store.heavyCoverBytes(track)).resolves.toBe(20_000_000);

    heavyCoverBytes.mockRejectedValue(new Error('boom'));

    await expect(store.heavyCoverBytes(track)).resolves.toBeNull();
    expect(store.errorKey).toBeNull();
  });
});

describe('useLibraryStore - multiple libraries', () => {
  it('loads the library list', async () => {
    listLibraries.mockResolvedValue(catalog);
    const store = useLibraryStore();

    await store.loadLibraries();

    expect(store.libraries).toHaveLength(2);
    expect(store.activeLibraryId).toBe('lib-1');
    expect(store.canDeleteLibrary).toBe(true);
    expect(store.canDeleteLibraryId('lib-1')).toBe(true);
    expect(store.canDeleteLibraryId('lib-2')).toBe(true);
  });

  it('does not allow deleting the only library', async () => {
    listLibraries.mockResolvedValue([catalog[0]!]);
    const store = useLibraryStore();

    await store.loadLibraries();

    expect(store.canDeleteLibrary).toBe(false);
    expect(store.canDeleteLibraryId('lib-1')).toBe(false);
    expect(store.canDeleteLibraryId(null)).toBe(false);
  });

  it('creates a library and updates the list', async () => {
    createLibrary.mockResolvedValue({ id: 'lib-3', name: 'Rock', trackCount: 0, active: false });
    listLibraries.mockResolvedValue(catalog);
    const store = useLibraryStore();

    await expect(store.createLibrary('  Rock  ')).resolves.toBe(true);

    expect(createLibrary).toHaveBeenCalledWith('Rock');
    expect(listLibraries).toHaveBeenCalled();
  });

  it('rejects an unnamed library', async () => {
    const store = useLibraryStore();

    await expect(store.createLibrary('   ')).resolves.toBe(false);

    expect(createLibrary).not.toHaveBeenCalled();
    expect(store.errorKey).toBe('invalidLibraryName');
  });

  it('opens the primary library for the home view', async () => {
    listLibraries.mockResolvedValue(catalog);
    switchLibrary.mockResolvedValue({ name: 'Jazz', metadata });
    libraryInfo.mockResolvedValue({ name: 'Jazz', metadata });
    listTracks.mockResolvedValue([makeTrack()]);
    const store = useLibraryStore();

    await store.loadHomeLibrary('lib-2');

    expect(switchLibrary).toHaveBeenCalledWith('lib-2');
    expect(store.libraryName).toBe('Jazz');
    expect(store.tracks).toHaveLength(1);
  });

  it('loads the active library when the primary library is missing', async () => {
    listLibraries.mockResolvedValue(catalog);
    const store = useLibraryStore();

    await store.loadHomeLibrary('lib-missing');

    expect(switchLibrary).not.toHaveBeenCalled();
    expect(listTracks).toHaveBeenCalledTimes(1);
  });

  it('opening another library reloads tracks and covers', async () => {
    listLibraries.mockResolvedValue(catalog);
    switchLibrary.mockResolvedValue({ name: 'Jazz', metadata });
    libraryInfo.mockResolvedValue({ name: 'Jazz', metadata });
    listTracks.mockResolvedValue([makeTrack()]);
    const store = useLibraryStore();
    await store.loadLibraries();
    store.select('id-1');
    await store.openEditor('id-1');

    await expect(store.switchLibrary('lib-2')).resolves.toBe(true);

    expect(switchLibrary).toHaveBeenCalledWith('lib-2');
    expect(store.libraryName).toBe('Jazz');
    expect(store.tracks).toHaveLength(1);
    expect(store.selectedId).toBeNull();
    expect(store.editingId).toBeNull();
  });

  it('does not reopen the already open library', async () => {
    listLibraries.mockResolvedValue(catalog);
    const store = useLibraryStore();
    await store.loadLibraries();

    await expect(store.switchLibrary('lib-1')).resolves.toBe(true);

    expect(switchLibrary).not.toHaveBeenCalled();
  });

  it('deletes a library that is not open without touching tracks', async () => {
    listLibraries.mockResolvedValue(catalog);
    deleteLibrary.mockResolvedValue([catalog[0]!]);
    const store = useLibraryStore();
    await store.loadLibraries();
    listTracks.mockClear();

    await expect(store.deleteLibrary('lib-2')).resolves.toBe(true);

    expect(store.libraries).toHaveLength(1);
    expect(listTracks).not.toHaveBeenCalled();
  });

  it('deleting the open library reloads the remaining one', async () => {
    listLibraries.mockResolvedValue(catalog);
    deleteLibrary.mockResolvedValue([{ ...catalog[1]!, active: true }]);
    libraryInfo.mockResolvedValue({ name: 'Jazz', metadata });
    const store = useLibraryStore();
    await store.loadLibraries();
    listTracks.mockClear();

    await expect(store.deleteLibrary('lib-1')).resolves.toBe(true);

    expect(listTracks).toHaveBeenCalledTimes(1);
    expect(store.libraryName).toBe('Jazz');
  });

  it('reports the file written by export', async () => {
    listLibraries.mockResolvedValue(catalog);
    pickExportFile.mockResolvedValue('C:/backup/jazz.json');
    exportLibrary.mockResolvedValue('C:/backup/jazz.json');
    const store = useLibraryStore();
    await store.loadLibraries();

    await expect(store.exportLibrary('lib-2')).resolves.toBe(true);

    expect(pickExportFile).toHaveBeenCalledWith('Jazz');
    expect(exportLibrary).toHaveBeenCalledWith('lib-2', 'C:/backup/jazz.json', 'full');
    expect(store.lastExport).toBe('C:/backup/jazz.json');

    store.dismissExport();
    expect(store.lastExport).toBeNull();
  });

  it('exports the track list in the selected format', async () => {
    const store = useLibraryStore();
    store.libraryName = 'Jazz Archive';
    pickTrackListExportFile.mockResolvedValue('C:/backup/tracks.csv');
    exportTrackList.mockResolvedValue('C:/backup/tracks.csv');

    await expect(store.exportTrackList('csv', ['title', 'artist'])).resolves.toBe(true);

    expect(pickTrackListExportFile).toHaveBeenCalledWith('Jazz Archive', 'csv');
    expect(exportTrackList).toHaveBeenCalledWith('C:/backup/tracks.csv', 'csv', [
      'title',
      'artist',
    ]);
    expect(store.lastExport).toBe('C:/backup/tracks.csv');
  });

  it('does not export the track list without selected fields', async () => {
    const store = useLibraryStore();

    await expect(store.exportTrackList('txt', [])).resolves.toBe(false);

    expect(pickTrackListExportFile).not.toHaveBeenCalled();
    expect(exportTrackList).not.toHaveBeenCalled();
  });

  it('cancelling file selection exports nothing', async () => {
    listLibraries.mockResolvedValue(catalog);
    pickExportFile.mockResolvedValue(null);
    const store = useLibraryStore();
    await store.loadLibraries();

    await expect(store.exportLibrary('lib-1')).resolves.toBe(false);

    expect(exportLibrary).not.toHaveBeenCalled();
    expect(store.lastExport).toBeNull();
  });

  it('imports a JSON library and reloads state and list', async () => {
    const imported = { added: 2, updated: 1, skipped: 0, missing: ['C:/missing.mp3'], total: 3 };
    pickImportFile.mockResolvedValue('C:/backup/jazz.json');
    importLibrary.mockResolvedValue(imported);
    libraryInfo.mockResolvedValue({ name: 'Imported', metadata });
    listTracks.mockResolvedValue([makeTrack()]);
    listLibraries.mockResolvedValue(catalog);
    const store = useLibraryStore();

    await expect(store.importLibrary('merge')).resolves.toBe(true);

    expect(pickImportFile).toHaveBeenCalledTimes(1);
    expect(importLibrary).toHaveBeenCalledWith('C:/backup/jazz.json', 'merge');
    expect(store.lastLibraryImport).toEqual(imported);
    expect(store.libraryName).toBe('Imported');
    expect(store.tracks).toHaveLength(1);
    expect(store.libraries).toEqual(catalog);

    store.dismissLibraryImport();
    expect(store.lastLibraryImport).toBeNull();
  });

  it('cancelling file selection imports nothing', async () => {
    pickImportFile.mockResolvedValue(null);
    const store = useLibraryStore();

    await expect(store.importLibrary('replace')).resolves.toBe(false);

    expect(importLibrary).not.toHaveBeenCalled();
    expect(store.lastLibraryImport).toBeNull();
    expect(store.isLibraryImporting).toBe(false);
  });

  it('reports the error if library import fails', async () => {
    pickImportFile.mockResolvedValue('C:/backup/rotto.json');
    importLibrary.mockRejectedValue(new Error('broken'));
    const store = useLibraryStore();

    await expect(store.importLibrary('mergeSkipDuplicates')).resolves.toBe(false);

    expect(store.errorKey).toBe('generic');
    expect(store.lastLibraryImport).toBeNull();
    expect(store.isLibraryImporting).toBe(false);
  });

  it('reports the error when the catalog does not respond', async () => {
    listLibraries.mockRejectedValue(new ShellUnavailableError());
    const store = useLibraryStore();

    await store.loadLibraries();

    expect(store.errorKey).toBe('shellUnavailable');
  });
});

describe('refresh from disk', () => {
  it('reads the files behind the list, and reports what changed outside the app', async () => {
    const library = useLibraryStore();
    const edited = makeTrack({ id: 'a', title: 'Edited outside' });
    listTracks.mockResolvedValueOnce([makeTrack({ id: 'a', title: 'Stale' })]);
    refreshLibraryFromDisk.mockResolvedValue({ refreshed: 1, missing: [] });
    listTracks.mockResolvedValueOnce([edited]);

    await library.loadHomeLibrary(null);
    await flushPromises();

    // The list is handed over first, then brought up to date.
    expect(library.tracks[0]?.title).toBe('Edited outside');
    expect(library.lastRefresh).toEqual({ refreshed: 1, missing: [] });
    expect(library.hasMissingAfterRefresh).toBe(false);
  });

  it('reports the files that are no longer on disk', async () => {
    const library = useLibraryStore();
    refreshLibraryFromDisk.mockResolvedValue({ refreshed: 0, missing: ['C:/music/gone.mp3'] });
    listTracks.mockResolvedValue([makeTrack({ missing: true })]);

    await library.refreshFromDisk();

    expect(library.hasMissingAfterRefresh).toBe(true);

    library.dismissRefresh();

    expect(library.lastRefresh).toBeNull();
  });

  it('reports a file that was missing and is found again', async () => {
    const library = useLibraryStore();
    const path = 'C:/music/back-again.mp3';
    library.tracks = [makeTrack({ path, missing: true })];
    refreshLibraryFromDisk.mockResolvedValue({ refreshed: 1, missing: [] });
    listTracks.mockResolvedValue([makeTrack({ path, missing: false })]);

    await library.refreshFromDisk();

    expect(library.lastRefreshRecovered).toBe(1);
    expect(library.tracks[0]?.missing).toBe(false);
  });

  it('names a set of missing files, and names two different sets apart', () => {
    const library = useLibraryStore();

    expect(library.missingReportKey).toBe('');

    library.lastRefresh = { refreshed: 0, missing: ['C:/a.mp3', 'C:/b.mp3'] };
    const key = library.missingReportKey;

    expect(key).not.toBe('');

    // The order the check read them in is not part of what was found.
    library.lastRefresh = { refreshed: 0, missing: ['C:/b.mp3', 'C:/a.mp3'] };

    expect(library.missingReportKey).toBe(key);

    library.lastRefresh = { refreshed: 0, missing: ['C:/a.mp3', 'C:/c.mp3'] };

    expect(library.missingReportKey).not.toBe(key);

    // Two paths run together must not read as the same set as one long one.
    library.lastRefresh = { refreshed: 0, missing: ['C:/ab.mp3'] };
    const joined = library.missingReportKey;
    library.lastRefresh = { refreshed: 0, missing: ['C:/a', 'b.mp3'] };

    expect(library.missingReportKey).not.toBe(joined);
  });

  it('leaves the list alone when the refresh fails', async () => {
    const library = useLibraryStore();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    listTracks.mockResolvedValue([makeTrack({ id: 'a' })]);
    await library.loadHomeLibrary(null);
    await flushPromises();

    refreshLibraryFromDisk.mockRejectedValue(new Error('disk busy'));
    await library.refreshFromDisk();

    expect(library.tracks).toHaveLength(1);
    expect(library.lastRefresh).toBeNull();
  });
});
