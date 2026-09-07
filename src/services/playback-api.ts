import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type { UnlistenFn } from '@tauri-apps/api/event';

import { isTauriRuntime, TRACK_SCHEME } from '@/config/app-config';
import { ShellUnavailableError } from '@/services/library-api';
import type { TrackView } from '@/types/library';

/** Where a track is read from, and the correction its own tags ask for. */
export interface PlaybackSource {
  url: string;
  gainDb: number | null;
}

/**
 * What is needed to play a track.
 *
 * The backend resolves the file, checks it is playable and reads the loudness it asks for;
 * the `track:` scheme checks the file again for itself when the bytes are actually read.
 */
export async function playbackSource(track: TrackView): Promise<PlaybackSource> {
  if (!isTauriRuntime()) {
    throw new ShellUnavailableError();
  }

  // The file opened from the system is known to the shell: it is asked for, not named.
  const source =
    track.standalone === true
      ? await invoke<ShellPlaybackSource>('prepare_external_playback')
      : await invoke<ShellPlaybackSource>('prepare_playback', { id: track.id });

  return {
    // Not the asset protocol: `track:` asks the library again when the bytes are read.
    url: convertFileSrc(source.path, TRACK_SCHEME),
    gainDb: source.gainDb,
  };
}

interface ShellPlaybackSource {
  path: string;
  gainDb: number | null;
}

export async function startupAudioFile(): Promise<TrackView | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const track = await invoke<TrackView | null>('startup_audio_file');

    return track === null ? null : { ...track, standalone: true };
  } catch (error) {
    console.error('Unable to read the startup audio file', error);

    return null;
  }
}

/** Listens for a later file-opening request forwarded by the single app instance. */
export async function onAudioFileOpened(run: () => void): Promise<UnlistenFn | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');

    return await listen('audio-file-opened', run);
  } catch (error) {
    console.error('Unable to listen for opened audio files', error);

    return null;
  }
}
