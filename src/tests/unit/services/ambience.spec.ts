import { describe, expect, it } from 'vitest';

import { accentPalette, colorChannels, contrastRatio, rotateHue } from '@/services/accent';
import { AMBIENT_HUE_SHIFT, ambience } from '@/services/ambience';
import { AMBIENT_DIRECTIONS } from '@/types/settings';

/** Reads a `#rrggbb` string back as the channels the contrast maths works on. */
function channels(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

/** Every `nn%` alpha the layers are built from, in the order they appear. */
function alphas(layers: string): number[] {
  return [...layers.matchAll(/\/ (\d+)%/g)].map((match) => Number(match[1]));
}

describe('ambience', () => {
  it('builds the three orbs plus the wash under them', () => {
    const { layers } = ambience('#0067c0', 'light');

    expect([...layers.matchAll(/radial-gradient/g)]).toHaveLength(3);
    expect([...layers.matchAll(/linear-gradient/g)]).toHaveLength(1);
  });

  it('derives the companion colour from the accent, fit for the theme', () => {
    const { secondary } = ambience('#0067c0', 'light');

    expect(secondary).toBe(accentPalette(rotateHue('#0067c0', AMBIENT_HUE_SHIFT), 'light').accent);
    expect(secondary).not.toBe('#0067c0');
  });

  // A dark green stays invisible over a dark window, and the colour rotated away from it
  // is darker still: both have to be lifted the way the interface accent is.
  it('paints the colours the theme made readable, not the raw ones', () => {
    const { layers, secondary } = ambience('#107c10', 'dark');

    expect(layers).not.toContain(colorChannels('#107c10'));
    expect(layers).toContain(colorChannels(accentPalette('#107c10', 'dark').accent));
    expect(layers).toContain(colorChannels(secondary));
  });

  it('lifts both colours clear of the dark window', () => {
    const { secondary } = ambience('#107c10', 'dark');
    const accent = accentPalette('#107c10', 'dark').accent;

    for (const color of [accent, secondary]) {
      expect(contrastRatio(channels(color), { r: 31, g: 31, b: 31 })).toBeGreaterThanOrEqual(4.4);
    }
  });

  it('follows the accent: a different colour gives a different background', () => {
    expect(ambience('#0067c0', 'light').layers).not.toBe(ambience('#e3008c', 'light').layers);
  });

  it('paints both colours into the layers', () => {
    const { layers, secondary } = ambience('#0067c0', 'light');

    expect(layers).toContain('0 103 192');
    expect(layers).toContain(
      [
        Number.parseInt(secondary.slice(1, 3), 16),
        Number.parseInt(secondary.slice(3, 5), 16),
        Number.parseInt(secondary.slice(5, 7), 16),
      ].join(' '),
    );
  });

  it('stays discreet: nothing is painted above a fifth of opacity', () => {
    for (const theme of ['light', 'dark'] as const) {
      for (const alpha of alphas(ambience('#0067c0', theme).layers)) {
        expect(alpha).toBeLessThanOrEqual(20);
      }
    }
  });

  it('holds back on the dark theme, where colour reads more easily', () => {
    const light = Math.max(...alphas(ambience('#0067c0', 'light').layers));
    const dark = Math.max(...alphas(ambience('#0067c0', 'dark').layers));

    expect(dark).toBeLessThan(light);
  });

  it('draws a different background for each type', () => {
    const orbs = ambience('#0067c0', 'light', 'orbs').layers;
    const linear = ambience('#0067c0', 'light', 'linear').layers;
    const spotlight = ambience('#0067c0', 'light', 'spotlight').layers;

    expect(new Set([orbs, linear, spotlight]).size).toBe(3);
    expect([...orbs.matchAll(/radial-gradient/g)]).toHaveLength(3);
    expect([...spotlight.matchAll(/radial-gradient/g)]).toHaveLength(1);
    expect(linear).not.toContain('radial-gradient');
  });

  it('starts the background from the chosen side', () => {
    const fromTopLeft = ambience('#0067c0', 'light', 'orbs', 'topLeft').layers;
    const fromBottomRight = ambience('#0067c0', 'light', 'orbs', 'bottomRight').layers;

    expect(fromTopLeft).toContain('at 6% -12%');
    expect(fromBottomRight).toContain('at 94% 112%');
    expect(fromTopLeft).not.toBe(fromBottomRight);
  });

  it('turns the linear gradient to follow the direction', () => {
    expect(ambience('#0067c0', 'light', 'linear', 'topLeft').layers).toContain('135deg');
    expect(ambience('#0067c0', 'light', 'linear', 'bottom').layers).toContain('0deg');
  });

  it('spreads the three orbs apart whichever side they start from', () => {
    for (const direction of AMBIENT_DIRECTIONS) {
      const positions = [
        ...ambience('#0067c0', 'light', 'orbs', direction).layers.matchAll(
          /at (-?[\d.]+)% (-?[\d.]+)%/g,
        ),
      ].map(([, x, y]) => `${x},${y}`);

      expect(new Set(positions).size).toBe(3);
    }
  });

  it('falls back to the built-in blue on a colour it cannot read', () => {
    expect(ambience('not a color', 'light').layers).toBe(ambience('#0067c0', 'light').layers);
  });
});

describe('rotateHue', () => {
  it('turns the colour without losing it', () => {
    expect(rotateHue('#0067c0', 140)).toMatch(/^#[\da-f]{6}$/);
  });

  it('comes back to the start after a full turn', () => {
    expect(rotateHue('#0067c0', 360)).toBe('#0067c0');
  });

  it('leaves a grey alone: it has no hue to turn', () => {
    expect(rotateHue('#808080', 140)).toBe('#808080');
  });

  it('turns each of the three primaries into the next one', () => {
    expect(rotateHue('#ff0000', 120)).toBe('#00ff00');
    expect(rotateHue('#00ff00', 120)).toBe('#0000ff');
    expect(rotateHue('#0000ff', 120)).toBe('#ff0000');
  });

  it('accepts a negative turn', () => {
    expect(rotateHue('#ff0000', -120)).toBe('#0000ff');
  });

  it('falls back when the colour is unreadable', () => {
    expect(rotateHue('nope', 140, '#ff0000')).toBe(rotateHue('#ff0000', 140));
  });
});
