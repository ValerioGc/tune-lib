import { describe, expect, it } from 'vitest';

import { coverAccentFromRgb } from '@/services/cover-accent';

describe('coverAccentFromRgb', () => {
  it('builds gradients from the average color', () => {
    const accent = coverAccentFromRgb(12.2, 99.8, 260);

    expect(accent.rgb).toBe('20 108 255');
    expect(accent.surfaceGradient).toContain('rgb(20 108 255 / 58%)');
    expect(accent.rowGradient).toContain('rgb(20 108 255 / 44%)');
  });

  it('increases the gradient intensity', () => {
    const accent = coverAccentFromRgb(12.2, 99.8, 260, { intensity: 150 });

    expect(accent.surfaceGradient).toContain('rgb(20 108 255 / 87%)');
    expect(accent.rowGradient).toContain('rgb(20 108 255 / 66%)');
  });
});
