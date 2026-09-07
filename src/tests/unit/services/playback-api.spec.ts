import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mocks.invoke,
  convertFileSrc: mocks.convertFileSrc,
}));

import { ShellUnavailableError } from '@/services/library-api';
import { makeTrack } from '@tests/support/tracks';

import { playbackSource, startupAudioFile } from '@/services/playback-api';

const scopedWindow = window as unknown as Record<string, unknown>;

beforeEach(() => {
  mocks.invoke.mockResolvedValue({ path: 'C:/music/track.mp3', gainDb: null });
  mocks.convertFileSrc.mockReturnValue('track://localhost/C%3A%2Fmusica%2Ftrack.mp3');
});

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('playbackSource', () => {
  it('resolves the track and points it at the track scheme', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    const source = await playbackSource(makeTrack({ id: 'id-1' }));

    expect(mocks.invoke).toHaveBeenCalledWith('prepare_playback', { id: 'id-1' });
    // Not the asset protocol: that one answers from a list granted in advance.
    expect(mocks.convertFileSrc).toHaveBeenCalledWith('C:/music/track.mp3', 'track');
    expect(source.url).toBe('track://localhost/C%3A%2Fmusica%2Ftrack.mp3');
  });

  it('carries the correction the file asks for', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.invoke.mockResolvedValue({ path: 'C:/music/loud.mp3', gainDb: -7.35 });

    await expect(playbackSource(makeTrack({ id: 'id-1' }))).resolves.toMatchObject({
      gainDb: -7.35,
    });
  });

  it('outside the shell it does not even try to play', async () => {
    await expect(playbackSource(makeTrack({ id: 'id-1' }))).rejects.toBeInstanceOf(
      ShellUnavailableError,
    );
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('asks for the startup file without naming it', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};

    await playbackSource(makeTrack({ path: 'C:/music/direct.mp3', standalone: true }));

    // The shell knows which file it was handed: a path from here would be a path it was
    // never given.
    expect(mocks.invoke).toHaveBeenCalledWith('prepare_external_playback');
  });

  it('loads the audio file passed when the app starts', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.invoke.mockResolvedValue(makeTrack({ id: 'direct' }));

    const track = await startupAudioFile();

    expect(mocks.invoke).toHaveBeenCalledWith('startup_audio_file');
    expect(track?.standalone).toBe(true);
  });

  it('ignores startup files outside the shell', async () => {
    await expect(startupAudioFile()).resolves.toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('ignores unreadable startup files', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.invoke.mockRejectedValue(new Error('broken audio'));

    await expect(startupAudioFile()).resolves.toBeNull();
  });
});
