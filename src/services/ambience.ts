import { accentPalette, colorChannels, rotateHue } from '@/services/accent';
import {
  DEFAULT_ACCENT_COLOR,
  type AmbientDirection,
  type AmbientStyle,
  type ResolvedTheme,
} from '@/types/settings';

/**
 * How far the companion colour sits from the accent on the colour wheel. Far enough for
 * the two to read as different colours, close enough to stay in the same family.
 */
export const AMBIENT_HUE_SHIFT = 140;

/** Where the background starts from, as a point in the window, and the angle away from it. */
export const ORIGINS: Record<AmbientDirection, { x: number; y: number; angle: number }> = {
  topLeft: { x: 6, y: -12, angle: 135 },
  top: { x: 50, y: -18, angle: 180 },
  topRight: { x: 94, y: -12, angle: 225 },
  left: { x: -8, y: 40, angle: 90 },
  right: { x: 108, y: 40, angle: 270 },
  bottomLeft: { x: 6, y: 112, angle: 45 },
  bottom: { x: 50, y: 118, angle: 0 },
  bottomRight: { x: 94, y: 112, angle: 315 },
};

/**
 * Peak opacity of the strongest layer. The background has to stay behind the interface:
 * on dark surfaces colour reads more easily, so it is dialled back there.
 */
const THEME_STRENGTH: Record<ResolvedTheme, number> = { light: 0.2, dark: 0.17 };

interface Point {
  x: number;
  y: number;
}

export interface Ambience {
  /** The value of `background-image`, from the topmost layer to the bottom one. */
  layers: string;
  /** The companion colour, as `#rrggbb`, already fit for the theme. */
  secondary: string;
}

/** Turns a point around the middle of the window, to spread the orbs apart evenly. */
function turn({ x, y }: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const [dx, dy] = [x - 50, y - 50];

  return {
    x: 50 + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: 50 + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function orb(at: Point, width: number, height: number, channels: string, alpha: number): string {
  return `radial-gradient(${width}rem ${height}rem at ${round(at.x)}% ${round(at.y)}%, rgb(${channels} / ${Math.round(alpha)}%), transparent 70%)`;
}

/**
 * Three blobs spread a third of a turn apart around the middle of the window: whichever
 * corner the background starts from, the colour reaches the other sides too.
 */
function orbLayers(origin: Point, accent: string, secondary: string, strength: number): string[] {
  return [
    orb(origin, 68, 46, accent, strength * 100),
    orb(turn(origin, 120), 54, 40, secondary, strength * 82),
    orb(turn(origin, 240), 58, 44, accent, strength * 60),
  ];
}

export function ambientLayers(
  accent: string,
  secondary: string,
  style: AmbientStyle,
  direction: AmbientDirection,
  strength: number,
): string {
  const { x, y, angle } = ORIGINS[direction];
  const origin = { x, y };
  const wash = `linear-gradient(${angle}deg, rgb(${accent} / ${Math.round(strength * 45)}%), transparent 46%, rgb(${secondary} / ${Math.round(strength * 45)}%))`;

  if (style === 'linear') {
    return `linear-gradient(${angle}deg, rgb(${accent} / ${Math.round(strength * 100)}%), rgb(${secondary} / ${Math.round(strength * 70)}%))`;
  }

  if (style === 'spotlight') {
    return [orb(origin, 96, 70, accent, strength * 100), wash].join(', ');
  }

  return [...orbLayers(origin, accent, secondary, strength), wash].join(', ');
}

/**
 * Builds the app background from the accent alone, so the window keeps one identity.
 *
 * Both colours pass through the accent palette first: the raw colour picked in the
 * settings can be far too dark to show against a dark window, and the companion colour
 * inherits that darkness from the rotation.
 */
export function ambience(
  accentColor: string,
  theme: ResolvedTheme,
  style: AmbientStyle = 'orbs',
  direction: AmbientDirection = 'topLeft',
): Ambience {
  const accent = accentPalette(accentColor, theme, DEFAULT_ACCENT_COLOR).accent;
  const secondary = accentPalette(rotateHue(accent, AMBIENT_HUE_SHIFT), theme).accent;

  return {
    secondary,
    layers: ambientLayers(
      colorChannels(accent),
      colorChannels(secondary),
      style,
      direction,
      THEME_STRENGTH[theme],
    ),
  };
}
