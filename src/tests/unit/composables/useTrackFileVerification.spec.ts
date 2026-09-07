import { describe, expect, it, vi } from 'vitest';

import { makeTrack } from '@tests/support/tracks';
import * as api from '@/services/library-api';

import { useTrackFileVerification } from '@/composables/useTrackFileVerification';

vi.mock('@/services/library-api', () => ({
  verifyTrackFile: vi.fn(),
}));

const verifyTrackFile = vi.mocked(api.verifyTrackFile);

describe('useTrackFileVerification', () => {
  it('verifies a track using its identifier', async () => {
    const track = makeTrack({ missing: false });
    const verified = { ...track, missing: true };
    verifyTrackFile.mockResolvedValue(verified);

    await expect(useTrackFileVerification().verify(track)).resolves.toEqual(verified);
    expect(verifyTrackFile).toHaveBeenCalledWith(track.id);
  });
});
