import type { MetadataUpdate } from '@/types/library';

export const MIN_YEAR = 1000;
export const MAX_TITLE_LENGTH = 512;
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const ALLOWED_COVER_MIME = ['image/png', 'image/jpeg'] as const;

/**
 * Validation errors are i18n keys under `metadata.errors`, so the UI stays free of
 * hardcoded text. The backend validates again: this is for immediate feedback only.
 */
export type FieldError = 'titleRequired' | 'titleTooLong' | 'yearOutOfRange' | null;
export type CoverError = 'coverType' | 'coverTooLarge' | null;

export function validateFilename(filename: string, original: string): string | null {
  if (filename.trim() === '') {
    return 'filenameRequired';
  }
  if (
    filename !== filename.trim() ||
    filename.endsWith('.') ||
    filename.length > 255 ||
    new TextEncoder().encode(filename).length > 255 ||
    [...filename].some(
      (character) => character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character),
    ) ||
    /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(filename)
  ) {
    return 'filenameInvalid';
  }
  if (
    !filename.slice(0, filename.lastIndexOf('.')).trim() ||
    filename.slice(filename.lastIndexOf('.')) !== original.slice(original.lastIndexOf('.'))
  ) {
    return 'filenameExtension';
  }
  return null;
}

export function maxYear(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}

export function validateTitle(title: string): FieldError {
  if (title.trim() === '') {
    return 'titleRequired';
  }

  return [...title].length > MAX_TITLE_LENGTH ? 'titleTooLong' : null;
}

/** The year field is optional: an empty value clears the tag. */
export function validateYear(year: string, now: Date = new Date()): FieldError {
  if (year.trim() === '') {
    return null;
  }

  if (!/^\d{1,4}$/u.test(year.trim())) {
    return 'yearOutOfRange';
  }

  const parsed = Number(year);

  return parsed >= MIN_YEAR && parsed <= maxYear(now) ? null : 'yearOutOfRange';
}

export function validateCoverFile(file: { type: string; size: number }): CoverError {
  if (!ALLOWED_COVER_MIME.includes(file.type as (typeof ALLOWED_COVER_MIME)[number])) {
    return 'coverType';
  }

  return file.size > MAX_COVER_BYTES ? 'coverTooLarge' : null;
}

export interface DraftMetadata {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
}

export function draftErrors(draft: DraftMetadata, now: Date = new Date()) {
  return {
    title: validateTitle(draft.title),
    year: validateYear(draft.year, now),
  };
}

export function isDraftValid(draft: DraftMetadata, now: Date = new Date()): boolean {
  return Object.values(draftErrors(draft, now)).every((error) => error === null);
}

/** Turns the form draft into the payload the backend expects. */
export function toUpdate(draft: DraftMetadata): MetadataUpdate {
  const clean = (value: string) => (value.trim() === '' ? null : value.trim());
  const year = clean(draft.year);

  return {
    title: draft.title.trim(),
    artist: clean(draft.artist),
    album: clean(draft.album),
    year: year === null ? null : Number(year),
    genre: clean(draft.genre),
  };
}
