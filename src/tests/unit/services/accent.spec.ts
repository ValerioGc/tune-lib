import { describe, expect, it } from 'vitest';

import { accentPalette, contrastRatio, normalizeAccentColor } from '@/services/accent';

/** Reads a `#rrggbb` string back as the channels the contrast maths works on. */
function channels(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

const WHITE = { r: 255, g: 255, b: 255 };
const DARK_SURFACE = { r: 31, g: 31, b: 31 };

describe('normalizeAccentColor', () => {
  it('accepts a full hex colour', () => {
    expect(normalizeAccentColor('#0067C0')).toBe('#0067c0');
  });

  it('accepts the shorthand and the missing hash', () => {
    expect(normalizeAccentColor('#0af')).toBe('#00aaff');
    expect(normalizeAccentColor('0067c0')).toBe('#0067c0');
  });

  it('ignores the surrounding spaces', () => {
    expect(normalizeAccentColor('  #107c10  ')).toBe('#107c10');
  });

  it('refuses what is not a colour', () => {
    expect(normalizeAccentColor('rosso')).toBeNull();
    expect(normalizeAccentColor('#12345')).toBeNull();
    expect(normalizeAccentColor(42)).toBeNull();
    expect(normalizeAccentColor(null)).toBeNull();
  });
});

describe('accentPalette', () => {
  it('returns the four tokens as hex colours', () => {
    const palette = accentPalette('#0067c0', 'light');

    for (const value of Object.values(palette)) {
      expect(value).toMatch(/^#[\da-f]{6}$/);
    }
  });

  it('keeps a colour that already reads on a white surface', () => {
    expect(accentPalette('#0067c0', 'light').accent).toBe('#0067c0');
  });

  it('darkens a colour too pale for the light theme', () => {
    const { accent } = accentPalette('#ffd700', 'light');

    expect(accent).not.toBe('#ffd700');
    expect(contrastRatio(channels(accent), WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('lightens a colour too dark for the dark theme', () => {
    const { accent } = accentPalette('#0067c0', 'dark');

    expect(contrastRatio(channels(accent), DARK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('reaches a readable accent from every preset, in both themes', () => {
    for (const color of ['#0067c0', '#107c10', '#e3008c', '#986f0b', '#000000', '#ffffff']) {
      expect(contrastRatio(channels(accentPalette(color, 'light').accent), WHITE)).toBeGreaterThan(
        4.4,
      );
      expect(
        contrastRatio(channels(accentPalette(color, 'dark').accent), DARK_SURFACE),
      ).toBeGreaterThan(4.4);
    }
  });

  it('picks a foreground that reads on top of the accent', () => {
    for (const color of ['#0067c0', '#ffd700', '#107c10', '#4cc2ff']) {
      const palette = accentPalette(color, 'light');

      expect(
        contrastRatio(channels(palette.onAccent), channels(palette.accent)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the soft tint close to the surface it sits on', () => {
    const light = accentPalette('#0067c0', 'light');
    const dark = accentPalette('#0067c0', 'dark');

    expect(contrastRatio(channels(light.accentSoft), WHITE)).toBeLessThan(1.5);
    expect(contrastRatio(channels(dark.accentSoft), DARK_SURFACE)).toBeLessThan(1.5);
  });

  it('moves the hover state away from the accent', () => {
    const palette = accentPalette('#0067c0', 'light');

    expect(palette.accentHover).not.toBe(palette.accent);
  });

  it('falls back on an invalid colour instead of breaking the interface', () => {
    expect(accentPalette('not a color', 'light', '#107c10').accent).toBe(
      accentPalette('#107c10', 'light').accent,
    );
  });

  it('falls back on the built-in blue when the fallback is invalid too', () => {
    expect(accentPalette('nope', 'light', 'neither')).toEqual(accentPalette('#0067c0', 'light'));
  });
});
