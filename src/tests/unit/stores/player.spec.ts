import { flushPromises } from '@vue/test-utils';
import { setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestPinia } from '@tests/support/mount';
import { makeTrack, makeTracks } from '@tests/support/tracks';
import type { AudioEngine, AudioEngineHandlers } from '@/services/audio-engine';
import { ShellUnavailableError } from '@/services/library-api';

const mocks = vi.hoisted(() => ({
  playbackSource: vi.fn(),
  createAudioEngine: vi.fn(),
}));

vi.mock('@/services/playback-api', () => ({ playbackSource: mocks.playbackSource }));
vi.mock('@/services/audio-engine', () => ({ createAudioEngine: mocks.createAudioEngine }));

import { usePlayerStore } from '@/stores/player';

let engine: AudioEngine;
let handlers: AudioEngineHandlers | null = null;

function makeEngine(): AudioEngine {
  return {
    load: vi.fn(),
    preload: vi.fn(),
    cancelPreload: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    setTrackGain: vi.fn(),
    release: vi.fn(),
  };
}

/** Events the audio element would send back to the store. */
function engineHandlers(): AudioEngineHandlers {
  if (handlers === null) {
    throw new Error('no engine created');
  }

  return handlers;
}

beforeEach(() => {
  setActivePinia(createTestPinia());
  engine = makeEngine();
  handlers = null;
  mocks.createAudioEngine.mockImplementation((given: AudioEngineHandlers) => {
    handlers = given;
    return engine;
  });
  mocks.playbackSource.mockResolvedValue({ url: 'track://track.mp3', gainDb: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/**
 * Makes the shuffle deterministic: every draw comes back as the lowest possible index,
 * which is what the expected orders below are written against.
 */
function stubLowestDraw() {
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((buffer) => {
    (buffer as Uint32Array).fill(0);
    return buffer;
  });
}

describe('usePlayerStore', () => {
  it('releases playback when its owning scope is disposed', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());
    player.$dispose();
    expect(engine.release).toHaveBeenCalledTimes(1);
  });
  it('ignores a slow source after another track has started', async () => {
    let finish!: (value: { url: string; gainDb: null }) => void;
    mocks.playbackSource.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const player = usePlayerStore();
    const old = player.play(makeTrack({ id: 'old' }));
    await player.play(makeTrack({ id: 'new' }));
    finish({ url: 'track://obsolete.mp3', gainDb: null });
    await old;
    expect(player.currentTrack?.id).toBe('new');
    expect(engine.load).toHaveBeenCalledTimes(1);
    expect(engine.load).not.toHaveBeenCalledWith('track://obsolete.mp3');
  });

  it('never starts a pending track after the player closes', async () => {
    let finish!: (value: { url: string; gainDb: null }) => void;
    mocks.playbackSource.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const player = usePlayerStore();
    const pending = player.play(makeTrack());
    player.close();
    finish({ url: 'track://closed.mp3', gainDb: null });
    await pending;
    expect(mocks.createAudioEngine).not.toHaveBeenCalled();
    expect(player.currentTrack).toBeNull();
  });

  it('ignores a pending preload after stop', async () => {
    const player = usePlayerStore();
    await player.playFrom([makeTrack({ id: 'a' }), makeTrack({ id: 'b' })], 'a');
    let finish!: (value: { url: string; gainDb: null }) => void;
    mocks.playbackSource.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    engineHandlers().onDuration(100);
    engineHandlers().onProgress(95);
    player.stop();
    finish({ url: 'track://unused.mp3', gainDb: null });
    await flushPromises();
    expect(engine.preload).not.toHaveBeenCalled();
    expect(engine.cancelPreload).toHaveBeenCalled();
  });

  it('ignores non-finite volume and seek requests', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());
    const volume = player.volume;
    player.setVolume(Number.NaN);
    player.seek(Number.POSITIVE_INFINITY);
    expect(player.volume).toBe(volume);
    expect(player.position).toBe(0);
  });
  it('starts with nothing playing', () => {
    const player = usePlayerStore();

    expect(player.currentTrack).toBeNull();
    expect(player.isActive).toBe(false);
    expect(player.isPlaying).toBe(false);
    expect(mocks.createAudioEngine).not.toHaveBeenCalled();
  });

  it('loads and starts the selected track', async () => {
    const player = usePlayerStore();
    const track = makeTrack({ title: 'Track' });

    await player.play(track);

    expect(mocks.playbackSource).toHaveBeenCalledWith(track);
    expect(engine.load).toHaveBeenCalledWith('track://track.mp3');
    expect(engine.play).toHaveBeenCalledTimes(1);
    expect(player.currentTrack?.title).toBe('Track');
    expect(player.isLoading).toBe(false);
  });

  it('uses metadata duration until the file declares its own', async () => {
    const player = usePlayerStore();

    await player.play(makeTrack({ durationMs: 185_000 }));

    expect(player.duration).toBe(185);

    engineHandlers().onDuration(184.2);

    expect(player.duration).toBe(184.2);
  });

  it('opens the next file while the current one is finishing', async () => {
    const player = usePlayerStore();
    const tracks = [makeTrack({ id: 'a' }), makeTrack({ id: 'b' })];
    await player.playFrom(tracks, 'a');
    mocks.playbackSource.mockResolvedValue({ url: 'track://b.mp3', gainDb: null });

    engineHandlers().onDuration(100);
    engineHandlers().onProgress(50);
    await flushPromises();

    expect(vi.mocked(engine.preload)).not.toHaveBeenCalled();

    engineHandlers().onProgress(90);
    await flushPromises();

    expect(vi.mocked(engine.preload)).toHaveBeenCalledWith('track://b.mp3');
  });

  it('opens the next file once, not on every tick of the clock', async () => {
    const player = usePlayerStore();
    await player.playFrom([makeTrack({ id: 'a' }), makeTrack({ id: 'b' })], 'a');
    engineHandlers().onDuration(100);

    for (const second of [90, 91, 92, 93]) {
      engineHandlers().onProgress(second);
      await flushPromises();
    }

    expect(vi.mocked(engine.preload)).toHaveBeenCalledTimes(1);
  });

  it('has nothing to open ahead when the track repeats itself', async () => {
    const player = usePlayerStore();
    await player.playFrom([makeTrack({ id: 'a' }), makeTrack({ id: 'b' })], 'a');
    player.toggleRepeatOne();
    engineHandlers().onDuration(100);

    engineHandlers().onProgress(95);
    await flushPromises();

    expect(vi.mocked(engine.preload)).not.toHaveBeenCalled();
  });

  it('uses the visible list as the queue', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(3);
    const secondo = tracks[1];

    await player.playFrom(tracks, secondo?.id ?? '');

    expect(player.queue).toHaveLength(3);
    expect(player.currentTrack?.id).toBe(secondo?.id);
    expect(player.hasPrevious).toBe(true);
    expect(player.hasNext).toBe(true);
  });

  it('prepares a shuffled queue while keeping the selected track first', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(4);
    stubLowestDraw();

    player.toggleShuffle();
    await player.playFrom(tracks, tracks[1]?.id ?? '');

    expect(player.isShuffleEnabled).toBe(true);
    expect(player.currentTrack?.id).toBe(tracks[1]?.id);
    expect(player.queue.map((track) => track.id)).toEqual([
      tracks[1]?.id,
      tracks[2]?.id,
      tracks[3]?.id,
      tracks[0]?.id,
    ]);
  });

  it('draws the shuffle from the platform generator, without repeating a track', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(20);
    const draw = vi.spyOn(globalThis.crypto, 'getRandomValues');

    player.toggleShuffle();
    await player.playFrom(tracks, tracks[0]?.id ?? '');

    expect(draw).toHaveBeenCalled();
    // Every track is still there, exactly once: the swap cannot lose or duplicate one.
    expect(new Set(player.queue.map((track) => track.id)).size).toBe(tracks.length);
    expect(player.queue).toHaveLength(tracks.length);
  });

  it('spreads the shuffle over every position it can reach', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(6);
    const seen = new Set<string>();

    for (let attempt = 0; attempt < 40; attempt += 1) {
      player.toggleShuffle();
      await player.playFrom(tracks, tracks[0]?.id ?? '');
      seen.add(player.queue.map((track) => track.id).join(','));
      player.toggleShuffle();
    }

    // A generator stuck on one value would produce the same order every time.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('restores library order when shuffled queue is disabled', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(3);
    stubLowestDraw();

    await player.playFrom(tracks, tracks[0]?.id ?? '');
    player.toggleShuffle();
    player.toggleShuffle();

    expect(player.isShuffleEnabled).toBe(false);
    expect(player.queue.map((track) => track.id)).toEqual(tracks.map((track) => track.id));
    expect(player.currentTrack?.id).toBe(tracks[0]?.id);
  });

  it('ignores a track that is not in the list', async () => {
    const player = usePlayerStore();

    await player.playFrom(makeTracks(2), 'id-assente');

    expect(player.isActive).toBe(false);
  });

  it('moves through the queue forward and backward', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(3);
    await player.playFrom(tracks, tracks[0]?.id ?? '');

    await player.next();
    expect(player.currentTrack?.id).toBe(tracks[1]?.id);

    await player.previous();
    expect(player.currentTrack?.id).toBe(tracks[0]?.id);
    expect(player.hasPrevious).toBe(false);
  });

  it('stops at the end of the queue', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    const ultimo = tracks[1];
    await player.playFrom(tracks, ultimo?.id ?? '');
    engineHandlers().onProgress(30);

    await player.next();

    expect(player.currentTrack?.id).toBe(ultimo?.id);
    expect(player.position).toBe(0);
    expect(player.isPlaying).toBe(false);
    expect(engine.pause).toHaveBeenCalled();
  });

  it('repeats the current track instead of stopping at the end of the queue', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    const ultimo = tracks[1];
    await player.playFrom(tracks, ultimo?.id ?? '');

    player.toggleRepeatOne();
    await player.next();

    expect(player.isRepeatOneEnabled).toBe(true);
    expect(player.currentTrack?.id).toBe(ultimo?.id);
    expect(player.hasNext).toBe(true);
    expect(engine.pause).not.toHaveBeenCalled();
    expect(engine.load).toHaveBeenCalledTimes(2);
  });

  it('moves to the next track when the current one ends', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    await player.playFrom(tracks, tracks[0]?.id ?? '');

    engineHandlers().onEnded();
    await Promise.resolve();

    expect(player.currentTrack?.id).toBe(tracks[1]?.id);
  });

  it('previous restarts from the beginning if the track already started', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    const secondo = tracks[1];
    await player.playFrom(tracks, secondo?.id ?? '');
    engineHandlers().onProgress(10);

    await player.previous();

    expect(player.currentTrack?.id).toBe(secondo?.id);
    expect(player.position).toBe(0);
    expect(engine.seek).toHaveBeenCalledWith(0);
  });

  it('pauses and resumes with the same command', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());
    engineHandlers().onPlayingChange(true);

    await player.toggle();
    expect(engine.pause).toHaveBeenCalledTimes(1);
    expect(player.isPlaying).toBe(false);

    await player.toggle();
    expect(engine.play).toHaveBeenCalledTimes(2);
  });

  it('stops and resets position to zero', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());
    engineHandlers().onProgress(45);

    player.stop();

    expect(player.position).toBe(0);
    expect(player.isPlaying).toBe(false);
    expect(engine.seek).toHaveBeenCalledWith(0);
  });

  it('clamps the seek position to track duration', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack({ durationMs: 100_000 }));

    player.seek(-5);
    expect(player.position).toBe(0);

    player.seek(500);
    expect(player.position).toBe(100);
    expect(engine.seek).toHaveBeenLastCalledWith(100);
  });

  it('computes progress as a fraction of duration', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack({ durationMs: 200_000 }));

    engineHandlers().onProgress(50);

    expect(player.progress).toBe(0.25);
  });

  it('keeps volume between zero and one and applies it to the player', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());

    player.setVolume(2);
    expect(player.volume).toBe(1);

    player.setVolume(-1);
    expect(player.volume).toBe(0);
    expect(engine.setVolume).toHaveBeenLastCalledWith(0);
  });

  it('applies the chosen volume before starting', async () => {
    const player = usePlayerStore();
    player.setVolume(0.3);

    await player.play(makeTrack());

    expect(engine.setVolume).toHaveBeenCalledWith(0.3);
  });

  it('does not try to play a file missing from disk', async () => {
    const player = usePlayerStore();

    await player.play(makeTrack({ missing: true }));

    expect(player.errorKey).toBe('missing');
    expect(mocks.playbackSource).not.toHaveBeenCalled();
    expect(mocks.createAudioEngine).not.toHaveBeenCalled();
  });

  it('explains that nothing plays in the browser', async () => {
    mocks.playbackSource.mockRejectedValue(new ShellUnavailableError());
    const player = usePlayerStore();

    await player.play(makeTrack());

    expect(player.errorKey).toBe('shellUnavailable');
    expect(player.isPlaying).toBe(false);
    expect(player.isLoading).toBe(false);
  });

  it('reports a failed start', async () => {
    mocks.playbackSource.mockRejectedValue(new Error('permesso negato'));
    const player = usePlayerStore();

    await player.play(makeTrack());

    expect(player.errorKey).toBe('generic');
  });

  it('reports the unplayable format from the player', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());

    engineHandlers().onError('unsupported');

    expect(player.errorKey).toBe('unsupported');
    expect(player.isPlaying).toBe(false);
  });

  it('clears the error when starting again', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack({ missing: true }));

    await player.play(makeTrack());

    expect(player.errorKey).toBeNull();
  });

  it('closing the player releases the source and clears the queue', async () => {
    const player = usePlayerStore();
    const tracks = makeTracks(2);
    await player.playFrom(tracks, tracks[0]?.id ?? '');
    player.expand();

    player.close();

    expect(engine.release).toHaveBeenCalledTimes(1);
    expect(player.queue).toHaveLength(0);
    expect(player.isActive).toBe(false);
    expect(player.isExpanded).toBe(false);
    expect(player.position).toBe(0);
  });

  it('recreates the source after closing', async () => {
    const player = usePlayerStore();
    await player.play(makeTrack());
    player.close();

    await player.play(makeTrack());

    expect(mocks.createAudioEngine).toHaveBeenCalledTimes(2);
  });

  it('silences the sound and brings the level back', () => {
    const player = usePlayerStore();

    player.setVolume(0.4);
    player.toggleMute();

    expect(player.volume).toBe(0);
    expect(player.isMuted).toBe(true);

    player.toggleMute();

    expect(player.volume).toBe(0.4);
    expect(player.isMuted).toBe(false);
  });

  it('reads a volume dragged to zero as muted', () => {
    const player = usePlayerStore();

    player.setVolume(0);

    expect(player.isMuted).toBe(true);

    // Nothing to come back to: unmuting falls back to the default level.
    player.toggleMute();

    expect(player.volume).toBeGreaterThan(0);
  });

  it('expands and collapses the view', () => {
    const player = usePlayerStore();

    player.toggleExpanded();
    expect(player.isExpanded).toBe(true);

    player.collapse();
    expect(player.isExpanded).toBe(false);
  });
});
