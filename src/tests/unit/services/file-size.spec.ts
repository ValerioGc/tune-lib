import { describe, expect, it } from 'vitest';

import { formatBytes } from '@/services/file-size';

describe('formatBytes', () => {
  it('keeps small sizes in whole bytes', () => {
    expect(formatBytes(0, 'en')).toBe('0 B');
    expect(formatBytes(512, 'en')).toBe('512 B');
  });

  it('climbs to the unit the number reads best in', () => {
    expect(formatBytes(1024, 'en')).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 3.5, 'en')).toBe('3.5 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 2, 'en')).toBe('2.0 GB');
  });

  it('stops at gigabytes rather than inventing a larger unit', () => {
    expect(formatBytes(1024 ** 4, 'en')).toBe('1,024.0 GB');
  });

  it('writes the separator of the language in use', () => {
    expect(formatBytes(1024 * 1536, 'it')).toBe('1,5 MB');
    expect(formatBytes(1024 * 1536, 'en')).toBe('1.5 MB');
  });

  it('reads a size that makes no sense as nothing at all', () => {
    expect(formatBytes(-1, 'en')).toBe('0 B');
    expect(formatBytes(Number.NaN, 'en')).toBe('0 B');
  });
});
