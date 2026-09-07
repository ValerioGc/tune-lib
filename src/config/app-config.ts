export const APP_NAME = 'TuneLib';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '1.0.0';

/** Where the project lives, as read from the about window. Update here if it moves. */
export const WEBSITE_URL = 'https://valeriogc.github.io/tune-lib/';
export const GITHUB_URL = 'https://github.com/ValerioGc/tune-lib';
export const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.txt`;

/**
 * How many artists a group names before it gives up and says they are various.
 *
 * A compilation lists nothing useful: past a handful of names the line stops being read
 * and starts being scrolled. Genres are left out of this: they are few and each one says
 * something about the group.
 */
/** The scheme the shell serves audio through. Mirrors `protocol::SCHEME`. */
export const TRACK_SCHEME = 'track';

/** The scheme the shell serves cover art through. Mirrors `protocol::COVER_SCHEME`. */
export const COVER_SCHEME = 'cover';

export const MAX_LISTED_ARTISTS = 3;

/** Longest name a library can be given. Mirrors `MAX_LIBRARY_NAME_LENGTH` in the shell,
 * which is the one that decides: this only keeps the field from taking more. */
export const MAX_LIBRARY_NAME_LENGTH = 120;

/** Audio formats handled by the library. Tag reading lands in phase 3. */
export const SUPPORTED_EXTENSIONS = ['mp3', 'flac', 'm4a', 'ogg', 'wav'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** True when the frontend runs inside the Tauri shell instead of a plain browser. */
export function isTauriRuntime(): boolean {
  return globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis.window;
}
