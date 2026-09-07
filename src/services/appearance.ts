import { accentPalette } from '@/services/accent';
import { ambience } from '@/services/ambience';
import {
  DEFAULT_ACCENT_COLOR,
  type AmbientDirection,
  type AmbientStyle,
  type Locale,
  type ResolvedTheme,
  type TextSize,
} from '@/types/settings';

export const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  xsmall: 0.8125,
  small: 0.875,
  medium: 1,
  large: 1.125,
};

export function applyTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function applyTextSize(size: TextSize, root: HTMLElement = document.documentElement) {
  root.style.setProperty('--app_font_scale', String(TEXT_SIZE_SCALE[size]));
}

export function applyDocumentLocale(locale: Locale, root: HTMLElement = document.documentElement) {
  root.lang = locale;
}

/**
 * Writes the accent tokens on the root element. Inline custom properties win over the
 * ones declared by the stylesheet, so the chosen colour replaces the built-in blue.
 */
export function applyAccent(
  color: string,
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement,
) {
  const palette = accentPalette(color, theme, DEFAULT_ACCENT_COLOR);

  root.style.setProperty('--color_accent', palette.accent);
  root.style.setProperty('--color_accent_hover', palette.accentHover);
  root.style.setProperty('--color_accent_soft', palette.accentSoft);
  root.style.setProperty('--color_on_accent', palette.onAccent);
}

/**
 * Writes the ambient background on the root element and says whether it is in use. The
 * layers are computed even when the option is off, so turning it back on costs nothing.
 */
export interface AmbientOptions {
  color: string;
  theme: ResolvedTheme;
  enabled: boolean;
  style: AmbientStyle;
  direction: AmbientDirection;
  /** Whether the panels opening over the window carry the same background. */
  panels: boolean;
}

export function applyAmbientBackground(
  { color, theme, enabled, style, direction, panels }: AmbientOptions,
  root: HTMLElement = document.documentElement,
) {
  root.dataset.ambient = enabled ? 'on' : 'off';
  root.dataset.ambientPanels = panels ? 'on' : 'off';
  root.style.setProperty('--app_ambient_layers', ambience(color, theme, style, direction).layers);
}

/** Turns the content surfaces to glass. The tokens themselves live in the stylesheet. */
export function applyGlassSurfaces(enabled: boolean, root: HTMLElement = document.documentElement) {
  root.dataset.glass = enabled ? 'on' : 'off';
}
