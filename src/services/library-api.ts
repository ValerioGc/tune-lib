import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { UnlistenFn } from '@tauri-apps/api/event';

import { APP_NAME, COVER_SCHEME, isTauriRuntime, SUPPORTED_EXTENSIONS } from '@/config/app-config';
import type {
  AddReport,
  Cover,
  CoverCacheReport,
  LibraryInfo,
  LibraryImportReport,
  LibraryExportMode,
  LibraryImportStrategy,
  LibraryRefreshReport,
  LibrarySummary,
  TrackExportField,
  TrackExportFormat,
  MetadataUpdate,
  Track,
  TrackView,
} from '@/types/library';

const EMPTY_LIBRARY_METADATA = {
  artists: [],
  albums: [],
  genres: [],
  artistArtwork: [],
  genreArtwork: [],
};

/** Raised when a feature needs the desktop shell and the app runs in a plain browser. */
export class ShellUnavailableError extends Error {
  constructor() {
    super('shell-unavailable');
    this.name = 'ShellUnavailableError';
  }
}

function requireShell() {
  if (!isTauriRuntime()) {
    throw new ShellUnavailableError();
  }
}

export async function listTracks(): Promise<TrackView[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<TrackView[]>('list_tracks');
}

export async function libraryInfo(): Promise<LibraryInfo> {
  if (!isTauriRuntime()) {
    return { name: APP_NAME, metadata: EMPTY_LIBRARY_METADATA };
  }

  return invoke<LibraryInfo>('library_info');
}

export async function renameLibrary(name: string): Promise<LibraryInfo> {
  requireShell();

  return invoke<LibraryInfo>('rename_library', { name });
}

export async function listLibraries(): Promise<LibrarySummary[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<LibrarySummary[]>('list_libraries');
}

export async function createLibrary(name: string): Promise<LibrarySummary> {
  requireShell();

  return invoke<LibrarySummary>('create_library', { name });
}

export async function switchLibrary(id: string): Promise<LibraryInfo> {
  requireShell();

  return invoke<LibraryInfo>('switch_library', { id });
}

export async function deleteLibrary(id: string): Promise<LibrarySummary[]> {
  requireShell();

  return invoke<LibrarySummary[]>('delete_library', { id });
}

/** Writes a copy of the library to `destination` and returns the file written. */
export async function exportLibrary(
  id: string,
  destination: string,
  mode: LibraryExportMode,
): Promise<string> {
  requireShell();

  return invoke<string>('export_library', { id, destination, mode });
}

export async function exportTrackList(
  destination: string,
  format: TrackExportFormat,
  fields: readonly TrackExportField[],
): Promise<string> {
  requireShell();

  return invoke<string>('export_track_list', { destination, format, fields: [...fields] });
}

export async function importLibrary(
  source: string,
  strategy: LibraryImportStrategy,
): Promise<LibraryImportReport> {
  requireShell();

  return invoke<LibraryImportReport>('import_library', { source, strategy });
}

/** Opens the save dialog for an export, returning null when the user cancels. */
export async function pickExportFile(defaultName: string): Promise<string | null> {
  requireShell();

  const { save } = await import('@tauri-apps/plugin-dialog');

  return save({
    defaultPath: `${defaultName}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
}

export async function pickTrackListExportFile(
  defaultName: string,
  format: TrackExportFormat,
): Promise<string | null> {
  requireShell();

  const { save } = await import('@tauri-apps/plugin-dialog');
  const extension = format === 'csv' ? 'csv' : 'txt';
  const filterName = format === 'csv' ? 'CSV' : 'TXT';

  return save({
    defaultPath: `${defaultName}-tracks.${extension}`,
    filters: [{ name: filterName, extensions: [extension] }],
  });
}

/** Opens the file picker for an app library JSON, returning null when cancelled. */
export async function pickImportFile(): Promise<string | null> {
  requireShell();

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selection = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  return Array.isArray(selection) ? (selection[0] ?? null) : selection;
}

export async function addTracks(paths: readonly string[]): Promise<AddReport> {
  requireShell();

  return invoke<AddReport>('add_tracks', { paths: [...paths] });
}

/** How far an import has got. `total` is 0 while the folders are still being walked. */
export type ImportProgress = { done: number; total: number; finalizing?: boolean };

/**
 * Follows an import while the backend reads the files it was given.
 *
 * Returns what stops the listening, or nothing outside the shell — where there is no
 * import to follow either.
 */
export async function onImportProgress(
  run: (progress: ImportProgress) => void,
): Promise<UnlistenFn | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');

    return await listen<ImportProgress>('library://import-progress', (event) => run(event.payload));
  } catch (error) {
    console.error('Unable to follow the import', error);

    return null;
  }
}

export async function removeTrack(id: string): Promise<boolean> {
  requireShell();

  return invoke<boolean>('remove_track', { id });
}

/**
 * Re-reads the files of the library, so tags edited by another program are picked up and
 * the ones no longer on disk are reported.
 */
export async function refreshLibraryFromDisk(): Promise<LibraryRefreshReport> {
  requireShell();

  return invoke<LibraryRefreshReport>('refresh_library_from_disk');
}

/**
 * Re-reads one file and returns it as it now stands, or null when it is no longer tracked.
 *
 * One file read: it is meant for the moments that need the file itself rather than what
 * the library last heard about it.
 */
export async function refreshTrack(id: string): Promise<TrackView | null> {
  requireShell();

  return invoke<TrackView | null>('refresh_track', { id });
}

export async function verifyTrackFile(id: string): Promise<TrackView> {
  requireShell();

  return invoke<TrackView>('verify_track_file', { id });
}

/**
 * Where the cover of a file can be fetched from.
 *
 * No round trip: the address is built here and the webview fetches, decodes and caches the
 * picture by itself, the way it does with any image. `version` changes when the cover is
 * edited, which is the only thing that makes the same address hold something else.
 */
export function coverUrl(path: string, version: number): string {
  if (!isTauriRuntime()) {
    return '';
  }

  return `${convertFileSrc(path, COVER_SCHEME)}?v=${version}`;
}

/** The weight of a cover left unread for being too heavy, when that is what happened. */
export async function heavyCoverBytes(path: string): Promise<number | null> {
  requireShell();

  return invoke<number | null>('heavy_cover_bytes', { path });
}

/** How much room the cached covers take on disk, and how much they are allowed. */
export async function coverCacheSize(): Promise<CoverCacheReport> {
  requireShell();

  return invoke<CoverCacheReport>('cover_cache_size');
}

/** Throws the cached covers away and reports what is left, which is nothing. */
export async function clearCoverCache(): Promise<CoverCacheReport> {
  requireShell();

  return invoke<CoverCacheReport>('clear_cover_cache');
}

export async function writeMetadata(id: string, update: MetadataUpdate): Promise<Track> {
  requireShell();

  return invoke<Track>('write_metadata', { id, update });
}

export async function writeCover(id: string, cover: Cover | null): Promise<Track> {
  requireShell();

  return invoke<Track>('write_cover', { id, cover });
}

export async function renameTrackFile(id: string, filename: string): Promise<Track> {
  requireShell();
  return invoke<Track>('rename_track_file', { id, filename });
}

/** Opens the system picker and returns the selected files, empty when cancelled. */
export async function pickAudioFiles(): Promise<string[]> {
  requireShell();

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selection = await open({
    multiple: true,
    filters: [{ name: 'Audio', extensions: [...SUPPORTED_EXTENSIONS] }],
  });

  if (selection === null) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

/** Opens the system picker on folders: everything audio inside is imported. */
export async function pickFolders(): Promise<string[]> {
  requireShell();

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selection = await open({ multiple: true, directory: true });

  if (selection === null) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}
