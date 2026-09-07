import { beforeEach, describe, expect, it } from 'vitest';

import { accentPalette } from '@/services/accent';
import { ambience } from '@/services/ambience';
import {
  TEXT_SIZE_SCALE,
  applyAccent,
  applyAmbientBackground,
  applyDocumentLocale,
  applyGlassSurfaces,
  applyTextSize,
  applyTheme,
} from '@/services/appearance';

describe('appearance', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
  });

  it('writes the theme as an attribute and color-scheme', () => {
    applyTheme('dark', root);

    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('replaces the previous theme', () => {
    applyTheme('dark', root);
    applyTheme('light', root);

    expect(root.dataset.theme).toBe('light');
  });

  it('applies the text scale as a CSS variable', () => {
    applyTextSize('large', root);

    expect(root.style.getPropertyValue('--app_font_scale')).toBe(String(TEXT_SIZE_SCALE.large));
  });

  it('uses increasing and distinct scales for each size', () => {
    expect(TEXT_SIZE_SCALE.small).toBeLessThan(TEXT_SIZE_SCALE.medium);
    expect(TEXT_SIZE_SCALE.medium).toBeLessThan(TEXT_SIZE_SCALE.large);
  });

  it('sets the document language', () => {
    applyDocumentLocale('en', root);

    expect(root.lang).toBe('en');
  });

  it('writes the four accent tokens', () => {
    applyAccent('#107c10', 'light', root);

    const palette = accentPalette('#107c10', 'light');

    expect(root.style.getPropertyValue('--color_accent')).toBe(palette.accent);
    expect(root.style.getPropertyValue('--color_accent_hover')).toBe(palette.accentHover);
    expect(root.style.getPropertyValue('--color_accent_soft')).toBe(palette.accentSoft);
    expect(root.style.getPropertyValue('--color_on_accent')).toBe(palette.onAccent);
  });

  it('derives a different accent for each theme', () => {
    applyAccent('#0067c0', 'light', root);
    const light = root.style.getPropertyValue('--color_accent_soft');

    applyAccent('#0067c0', 'dark', root);

    expect(root.style.getPropertyValue('--color_accent_soft')).not.toBe(light);
  });

  it('keeps the interface usable when the stored colour is broken', () => {
    applyAccent('not a colour', 'light', root);

    expect(root.style.getPropertyValue('--color_accent')).toBe(
      accentPalette('#0067c0', 'light').accent,
    );
  });

  it('writes the ambient layers and says the background is in use', () => {
    applyAmbientBackground(
      {
        color: '#0067c0',
        theme: 'light',
        enabled: true,
        style: 'orbs',
        direction: 'topLeft',
        panels: true,
      },
      root,
    );

    expect(root.dataset.ambient).toBe('on');
    // The panels opening over the window read the same answer.
    expect(root.dataset.ambientPanels).toBe('on');
    expect(root.style.getPropertyValue('--app_ambient_layers')).toBe(
      ambience('#0067c0', 'light').layers,
    );
  });

  it('keeps the layers ready when the background is off', () => {
    applyAmbientBackground(
      {
        color: '#0067c0',
        theme: 'light',
        enabled: false,
        style: 'orbs',
        direction: 'topLeft',
        panels: true,
      },
      root,
    );

    expect(root.dataset.ambient).toBe('off');
    expect(root.style.getPropertyValue('--app_ambient_layers')).not.toBe('');
  });

  it('turns the glass surfaces on and off', () => {
    applyGlassSurfaces(true, root);
    expect(root.dataset.glass).toBe('on');

    applyGlassSurfaces(false, root);
    expect(root.dataset.glass).toBe('off');
  });

  it('uses documentElement as the default root', () => {
    applyTheme('dark');
    applyTextSize('small');
    applyDocumentLocale('it');
    applyAccent('#e3008c', 'dark');
    applyAmbientBackground({
      color: '#e3008c',
      theme: 'dark',
      enabled: true,
      panels: true,
      style: 'orbs',
      direction: 'topLeft',
    });
    applyGlassSurfaces(true);

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.ambient).toBe('on');
    expect(document.documentElement.dataset.glass).toBe('on');
    expect(document.documentElement.style.getPropertyValue('--color_accent')).toBe(
      accentPalette('#e3008c', 'dark').accent,
    );
    expect(document.documentElement.style.getPropertyValue('--app_font_scale')).toBe('0.875');
    expect(document.documentElement.lang).toBe('it');
  });
});
