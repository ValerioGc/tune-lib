import { ORIGINS } from '@/services/ambience';
import { DEFAULT_SETTINGS, type AmbientDirection, type AmbientStyle } from '@/types/settings';

export interface CoverAccent {
  rgb: string;
  surfaceGradient: string;
  rowGradient: string;
}

const SAMPLE_SIZE = 32;
const MIN_ALPHA = 32;
const MAX_GRADIENT_ALPHA = 92;

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function gradientAlpha(base: number, intensity: number): number {
  return Math.min(MAX_GRADIENT_ALPHA, Math.max(0, Math.round((base * intensity) / 100)));
}

function liftDarkColor(red: number, green: number, blue: number): [number, number, number] {
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  if (luminance >= 104) {
    return [red, green, blue];
  }

  const lift = 104 - luminance;

  return [red + lift * 0.7, green + lift * 0.7, blue + lift * 0.9];
}

/**
 * The player surface, drawn from the colour of the cover: the same three shapes and the
 * same origins as the app background, so the two read as one family.
 */
function surfaceLayers(
  rgb: string,
  intensity: number,
  style: AmbientStyle,
  direction: AmbientDirection,
): string {
  const { x, y, angle } = ORIGINS[direction];
  const strong = gradientAlpha(58, intensity);
  const mid = gradientAlpha(32, intensity);
  const linear = gradientAlpha(42, intensity);
  const linearSoft = gradientAlpha(18, intensity);
  const wash = `linear-gradient(${angle}deg, rgb(${rgb} / ${linear}%), rgb(${rgb} / ${linearSoft}%) 54%, transparent 88%)`;

  if (style === 'linear') {
    return `linear-gradient(${angle}deg, rgb(${rgb} / ${strong}%), rgb(${rgb} / ${linearSoft}%) 72%, transparent 100%)`;
  }

  if (style === 'spotlight') {
    return `radial-gradient(circle at ${x}% ${y}%, rgb(${rgb} / ${strong}%), rgb(${rgb} / ${mid}%) 46%, transparent 82%), ${wash}`;
  }

  return `radial-gradient(circle at ${x}% ${y}%, rgb(${rgb} / ${strong}%), rgb(${rgb} / ${mid}%) 34%, transparent 68%), ${wash}`;
}

/** How strong the gradient is drawn, in which shape, and from which corner. */
export interface CoverGradientShape {
  intensity?: number;
  style?: AmbientStyle;
  direction?: AmbientDirection;
}

export function coverAccentFromRgb(
  red: number,
  green: number,
  blue: number,
  shape: CoverGradientShape = {},
): CoverAccent {
  const {
    intensity = 100,
    style = DEFAULT_SETTINGS.coverGradientStyle,
    direction = DEFAULT_SETTINGS.coverGradientDirection,
  } = shape;
  const [visibleRed, visibleGreen, visibleBlue] = liftDarkColor(red, green, blue);
  const rgb = `${clampChannel(visibleRed)} ${clampChannel(visibleGreen)} ${clampChannel(visibleBlue)}`;
  const rowStrong = gradientAlpha(44, intensity);
  const rowSoft = gradientAlpha(24, intensity);

  return {
    rgb,
    surfaceGradient: surfaceLayers(rgb, intensity, style, direction),
    rowGradient: `linear-gradient(90deg, rgb(${rgb} / ${rowStrong}%), rgb(${rgb} / ${rowSoft}%) 48%, transparent 100%)`,
  };
}

function imageFromSource(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('cover-not-readable'));
    // Cover files come from the app's protected custom scheme. Anonymous CORS keeps the
    // decoded image usable by the canvas instead of tainting it before getImageData().
    image.crossOrigin = 'anonymous';
    image.src = source;
  });
}

export async function dominantCoverAccent(
  source: string,
  shape: CoverGradientShape = {},
): Promise<CoverAccent | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (context === null) {
    return null;
  }

  try {
    const image = await imageFromSource(source);
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    let red = 0;
    let green = 0;
    let blue = 0;
    let samples = 0;

    for (let index = 0; index < data.length; index += 4) {
      if ((data[index + 3] ?? 0) < MIN_ALPHA) {
        continue;
      }

      red += data[index] ?? 0;
      green += data[index + 1] ?? 0;
      blue += data[index + 2] ?? 0;
      samples += 1;
    }

    return samples === 0
      ? null
      : coverAccentFromRgb(red / samples, green / samples, blue / samples, shape);
  } catch {
    return null;
  }
}
