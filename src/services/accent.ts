import type { ResolvedTheme } from '@/types/settings';

/** The four accent tokens the interface reads, derived from a single chosen colour. */
export interface AccentPalette {
  accent: string;
  accentHover: string;
  accentSoft: string;
  onAccent: string;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Matches `--color_bg` of the dark theme: the surface the accent is read against. */
const DARK_SURFACE: Rgb = { r: 31, g: 31, b: 31 };

/** The accent also carries text (links, active sorting, badges), so it targets AA. */
const MIN_ACCENT_CONTRAST = 4.5;

const HEX_PATTERN = /^#?([\da-f]{3}|[\da-f]{6})$/i;

function expandShorthand(hex: string): string {
  return hex.length === 3
    ? hex
        .split('')
        .map((channel) => channel + channel)
        .join('')
    : hex;
}

function parseHex(value: string): Rgb | null {
  const match = HEX_PATTERN.exec(value.trim());

  if (match === null) {
    return null;
  }

  const hex = expandShorthand(match[1]!);

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** Mixes `base` towards `target`, where `ratio` is how much of `target` is used. */
function mix(base: Rgb, target: Rgb, ratio: number): Rgb {
  const amount = Math.min(1, Math.max(0, ratio));

  return {
    r: base.r + (target.r - base.r) * amount,
    g: base.g + (target.g - base.g) * amount,
    b: base.b + (target.b - base.b) * amount,
  };
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, between 0 (black) and 1 (white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio, between 1 (identical) and 21 (black on white). */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pushes the chosen colour towards white on dark backgrounds, and towards black on light
 * ones, until it is readable. A colour picked for one theme stays usable in the other.
 */
function readableOnSurface(color: Rgb, theme: ResolvedTheme): Rgb {
  const surface = theme === 'dark' ? DARK_SURFACE : WHITE;
  const towards = theme === 'dark' ? WHITE : BLACK;

  for (let ratio = 0; ratio < 1; ratio += 0.04) {
    const candidate = mix(color, towards, ratio);

    if (contrastRatio(candidate, surface) >= MIN_ACCENT_CONTRAST) {
      return candidate;
    }
  }

  return towards;
}

/** White or a very dark tint of the accent, whichever reads better on top of it. */
function foregroundFor(accent: Rgb): Rgb {
  const shade = mix(accent, BLACK, 0.85);

  return contrastRatio(accent, WHITE) >= contrastRatio(accent, shade) ? WHITE : shade;
}

function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const span = max - min;
  const l = (max + min) / 2;

  if (span === 0) {
    return { h: 0, s: 0, l };
  }

  const s = span / (1 - Math.abs(2 * l - 1));
  let h: number;

  if (max === red) {
    h = ((green - blue) / span) % 6;
  } else if (max === green) {
    h = (blue - red) / span + 2;
  } else {
    h = (red - green) / span + 4;
  }

  return { h: (((h * 60) % 360) + 360) % 360, s, l };
}

function fromHsl(h: number, s: number, l: number): Rgb {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = (((h % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const lightest = l - chroma / 2;

  const [red, green, blue] = (
    [
      [chroma, second, 0],
      [second, chroma, 0],
      [0, chroma, second],
      [0, second, chroma],
      [second, 0, chroma],
      [chroma, 0, second],
    ] as const
  )[Math.floor(sector) % 6]!;

  return {
    r: (red + lightest) * 255,
    g: (green + lightest) * 255,
    b: (blue + lightest) * 255,
  };
}

/**
 * The chosen colour turned around the colour wheel. Used to pick a companion colour that
 * belongs to the accent instead of being a second choice the user has to make.
 */
export function rotateHue(color: string, degrees: number, fallback = '#0067c0'): string {
  const parsed = parseHex(color) ?? parseHex(fallback) ?? { r: 0, g: 103, b: 192 };
  const { h, s, l } = toHsl(parsed);

  return toHex(fromHsl(h + degrees, s, l));
}

/** The channels of a colour as `r g b`, ready for the `rgb(… / …%)` CSS notation. */
export function colorChannels(color: string, fallback = '#0067c0'): string {
  const { r, g, b } = parseHex(color) ?? parseHex(fallback) ?? { r: 0, g: 103, b: 192 };

  return `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`;
}

/**
 * Accepts a colour written by the user or read from disk and returns it as `#rrggbb`,
 * or `null` when it is not a colour at all.
 */
export function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = parseHex(value);

  return parsed === null ? null : toHex(parsed);
}

/** Builds the accent tokens for one theme. Falls back to `fallback` on an invalid colour. */
export function accentPalette(
  color: string,
  theme: ResolvedTheme,
  fallback = '#0067c0',
): AccentPalette {
  const parsed = parseHex(color) ?? parseHex(fallback) ?? { r: 0, g: 103, b: 192 };
  const accent = readableOnSurface(parsed, theme);
  const surface = theme === 'dark' ? DARK_SURFACE : WHITE;

  return {
    accent: toHex(accent),
    accentHover: toHex(mix(accent, theme === 'dark' ? WHITE : BLACK, 0.18)),
    accentSoft: toHex(mix(accent, surface, theme === 'dark' ? 0.85 : 0.9)),
    onAccent: toHex(foregroundFor(accent)),
  };
}
