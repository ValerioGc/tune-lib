import { describe, expect, it } from 'vitest';

import {
  MAX_COVER_BYTES,
  MAX_TITLE_LENGTH,
  MIN_YEAR,
  draftErrors,
  isDraftValid,
  maxYear,
  toUpdate,
  validateCoverFile,
  validateTitle,
  validateYear,
  type DraftMetadata,
} from '@/services/metadata-validation';

const now = new Date('2026-08-18T00:00:00Z');

function draft(overrides: Partial<DraftMetadata> = {}): DraftMetadata {
  return {
    title: 'Title',
    artist: 'Artist',
    album: 'Album',
    year: '1999',
    genre: 'Rock',
    ...overrides,
  };
}

describe('validateTitle', () => {
  it('accepts a normal title', () => {
    expect(validateTitle('Title')).toBeNull();
  });

  it('rejects an empty or whitespace-only title', () => {
    expect(validateTitle('')).toBe('titleRequired');
    expect(validateTitle('   ')).toBe('titleRequired');
  });

  it('rejects an overly long title', () => {
    expect(validateTitle('a'.repeat(MAX_TITLE_LENGTH))).toBeNull();
    expect(validateTitle('a'.repeat(MAX_TITLE_LENGTH + 1))).toBe('titleTooLong');
  });
});

describe('validateYear', () => {
  it('accepts the empty field, which clears the tag', () => {
    expect(validateYear('', now)).toBeNull();
    expect(validateYear('  ', now)).toBeNull();
  });

  it('accepts the range boundaries', () => {
    expect(validateYear(String(MIN_YEAR), now)).toBeNull();
    expect(validateYear(String(maxYear(now)), now)).toBeNull();
  });

  it('rejects years outside the range', () => {
    expect(validateYear(String(MIN_YEAR - 1), now)).toBe('yearOutOfRange');
    expect(validateYear(String(maxYear(now) + 1), now)).toBe('yearOutOfRange');
  });

  it('rejects a non-numeric value', () => {
    expect(validateYear('millenovecento', now)).toBe('yearOutOfRange');
    expect(validateYear('19x9', now)).toBe('yearOutOfRange');
    expect(validateYear('-1999', now)).toBe('yearOutOfRange');
  });

  it('allows next year for upcoming releases', () => {
    expect(maxYear(now)).toBe(2027);
  });
});

describe('validateCoverFile', () => {
  it('accepts png and jpeg within the limit', () => {
    expect(validateCoverFile({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validateCoverFile({ type: 'image/jpeg', size: MAX_COVER_BYTES })).toBeNull();
  });

  it('rejects other formats', () => {
    expect(validateCoverFile({ type: 'image/gif', size: 10 })).toBe('coverType');
    expect(validateCoverFile({ type: 'application/pdf', size: 10 })).toBe('coverType');
  });

  it('rejects oversized images', () => {
    expect(validateCoverFile({ type: 'image/png', size: MAX_COVER_BYTES + 1 })).toBe(
      'coverTooLarge',
    );
  });
});

describe('draftErrors', () => {
  it('reports nothing for a valid draft', () => {
    expect(draftErrors(draft(), now)).toEqual({ title: null, year: null });
    expect(isDraftValid(draft(), now)).toBe(true);
  });

  it('reports invalid fields', () => {
    const errors = draftErrors(draft({ title: '', year: '12' }), now);

    expect(errors.title).toBe('titleRequired');
    expect(errors.year).toBe('yearOutOfRange');
    expect(isDraftValid(draft({ title: '' }), now)).toBe(false);
  });
});

describe('toUpdate', () => {
  it('trims whitespace and converts the year', () => {
    expect(
      toUpdate(draft({ title: '  Title  ', artist: ' Artist ', album: ' Album ', year: ' 1999 ' })),
    ).toEqual({
      title: 'Title',
      artist: 'Artist',
      album: 'Album',
      year: 1999,
      genre: 'Rock',
    });
  });

  it('turns empty fields into null to clear tags', () => {
    expect(toUpdate(draft({ artist: '', album: '', year: '', genre: '   ' }))).toEqual({
      title: 'Title',
      artist: null,
      album: null,
      year: null,
      genre: null,
    });
  });
});
