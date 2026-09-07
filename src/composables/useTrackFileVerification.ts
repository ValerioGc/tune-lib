import * as api from '@/services/library-api';
import type { TrackView } from '@/types/library';

export interface TrackFileVerification {
  verify(track: TrackView): Promise<TrackView>;
}

export function useTrackFileVerification(): TrackFileVerification {
  return {
    verify(track: TrackView) {
      return api.verifyTrackFile(track.id);
    },
  };
}
