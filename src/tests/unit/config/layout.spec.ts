import { afterEach, describe, expect, it } from 'vitest';

import { LIBRARY_ROW_HEIGHT_REM, libraryRowHeight, remToPixels } from '@/config/layout';

afterEach(() => {
  document.documentElement.style.removeProperty('font-size');
});

describe('remToPixels', () => {
  it('converts using the current text size', () => {
    document.documentElement.style.fontSize = '16px';

    expect(remToPixels(LIBRARY_ROW_HEIGHT_REM)).toBe(56);
  });

  it('follows text enlargement', () => {
    document.documentElement.style.fontSize = '20px';

    expect(remToPixels(LIBRARY_ROW_HEIGHT_REM)).toBe(70);
  });

  it('falls back to 16px when the value is unreadable', () => {
    document.documentElement.style.fontSize = 'inherit';

    expect(remToPixels(2)).toBe(32);
  });
});

describe('libraryRowHeight', () => {
  it('keeps the base height while the cover fits inside it', () => {
    document.documentElement.style.fontSize = '16px';

    expect(libraryRowHeight(44)).toBe(56);
    expect(libraryRowHeight(48)).toBe(56);
  });

  it('grows with the cover column once the cover needs the room', () => {
    document.documentElement.style.fontSize = '16px';

    expect(libraryRowHeight(64)).toBe(64);
    expect(libraryRowHeight(72)).toBe(72);
  });

  /** The cover fills its row corner to corner, so the row is exactly as tall as it is wide. */
  it('is as tall as the cover once the cover is the taller of the two', () => {
    document.documentElement.style.fontSize = '16px';

    for (const width of [60, 64, 72, 80]) {
      expect(libraryRowHeight(width)).toBe(width);
    }
  });

  it('still follows the text size when the cover is small', () => {
    document.documentElement.style.fontSize = '20px';

    expect(libraryRowHeight(48)).toBe(70);
  });
});
