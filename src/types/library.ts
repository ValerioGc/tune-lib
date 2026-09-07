/** Mirrors the Rust models: the backend serializes them in camelCase. */

export interface Track {
  id: string;
  path: string;
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
  durationMs: number;
  format: string;
  hasCover: boolean;
  addedAt: number;
}

export interface TrackView extends Track {
  missing: boolean;
  standalone?: boolean;
}

export interface TrackSelectionIntent {
  id: string;
  additive: boolean;
  range: boolean;
}

export interface FailedImport {
  path: string;
  reason: string;
}

export interface AddReport {
  added: Track[];
  duplicates: string[];
  failed: FailedImport[];
}

export interface Cover {
  mimeType: string;
  data: string;
}

export interface LibraryArtwork {
  name: string;
  cover: Cover;
}

export interface LibraryMetadata {
  artists: string[];
  albums: string[];
  genres: string[];
  artistArtwork: LibraryArtwork[];
  genreArtwork: LibraryArtwork[];
}

export interface LibraryInfo {
  name: string;
  metadata: LibraryMetadata;
}

/** One library of the catalog, as listed in the settings and in the homepage menu. */
export interface LibrarySummary {
  id: string;
  name: string;
  trackCount: number;
  active: boolean;
}

export type LibraryImportStrategy = 'replace' | 'merge' | 'mergeSkipDuplicates';

/**
 * How much of the library an export carries.
 *
 * `full` writes it as it stands, artwork included. `paths` writes only where the files are,
 * and the tags are read back from those files when the export is imported: a far smaller
 * file, at the cost of needing the same files in the same places.
 */
export const LIBRARY_EXPORT_MODES = ['full', 'paths'] as const;
export type LibraryExportMode = (typeof LIBRARY_EXPORT_MODES)[number];

export interface LibraryImportReport {
  added: number;
  updated: number;
  skipped: number;
  missing: string[];
  total: number;
}

/** Payload of the `write_metadata` command: `null` clears the corresponding tag. */
export interface MetadataUpdate {
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  genre: string | null;
}

export const SORTABLE_COLUMNS = ['title', 'artist', 'album', 'year', 'genre', 'duration'] as const;
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const LIBRARY_CONTENT_TABS = ['tracks', 'artists', 'albums', 'genres'] as const;
export type LibraryContentTab = (typeof LIBRARY_CONTENT_TABS)[number];

export const MISSING_INFO_FILTERS = [
  'all',
  'file',
  'cover',
  'artist',
  'album',
  'year',
  'genre',
] as const;
export type MissingInfoFilter = (typeof MISSING_INFO_FILTERS)[number];

export const TRACK_EXPORT_FORMATS = ['csv', 'txt'] as const;
export type TrackExportFormat = (typeof TRACK_EXPORT_FORMATS)[number];

export const TRACK_EXPORT_FIELDS = [
  'title',
  'artist',
  'album',
  'year',
  'genre',
  'duration',
  'format',
  'path',
  'missing',
] as const;
export type TrackExportField = (typeof TRACK_EXPORT_FIELDS)[number];

/** What a refresh from disk found: entries brought up to date, and files gone missing. */
export interface LibraryRefreshReport {
  refreshed: number;
  missing: string[];
}

/**
 * What looking for the cover of a file found.
 *
 * A file with no cover and a file whose cover is too heavy to read both come back without
 * a picture, but only the second is worth telling the user about.
 */
export interface CoverRead {
  cover: Cover | null;
  tooLargeBytes: number | null;
}

/** What the cover cache weighs on disk, and the weight it is kept under. */
export interface CoverCacheReport {
  bytes: number;
  limitBytes: number;
}

export interface TrackListVerificationReport {
  total: number;
  missing: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortableColumn;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortState = { column: 'title', direction: 'asc' };
