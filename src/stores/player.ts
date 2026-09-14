import { defineStore } from 'pinia';
import { computed, onScopeDispose, ref } from 'vue';

import { createAudioEngine, type AudioEngine } from '@/services/audio-engine';
import type { CoverAccent } from '@/services/cover-accent';
import { ShellUnavailableError } from '@/services/library-api';
import { playbackSource } from '@/services/playback-api';
import type { TrackView } from '@/types/library';

/** i18n key describing why playback stopped, so the UI stays free of hardcoded text. */
export type PlayerErrorKey = 'missing' | 'unsupported' | 'shellUnavailable' | 'generic' | null;

/**
 * How long before the end the next file is opened.
 *
 * Long enough for a header to be read and a buffer to fill, short enough that a listener
 * skipping through a queue does not leave a trail of half-opened files behind them.
 */
const PRELOAD_LEAD_SECONDS = 15;

/** Past this point "previous" restarts the track instead of going back in the queue. */
const RESTART_THRESHOLD_SECONDS = 3;
const DEFAULT_VOLUME = 0.8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const UINT32_RANGE = 2 ** 32;

/**
 * A random index in `[0, bound)`, drawn from the platform generator.
 *
 * The draw is repeated when the value falls in the incomplete last block of the 32-bit
 * range: taking the remainder of the whole range would leave the first few indexes
 * slightly more likely than the others.
 */
function randomIndex(bound: number): number {
  const limit = Math.floor(UINT32_RANGE / bound) * bound;
  const buffer = new Uint32Array(1);

  let value: number;

  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] as number;
  } while (value >= limit);

  return value % bound;
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];

  for (let index_ = result.length - 1; index_ > 0; index_ -= 1) {
    const nextIndex = randomIndex(index_ + 1);
    const current = result[index_];
    result[index_] = result[nextIndex] as T;
    result[nextIndex] = current as T;
  }

  return result;
}

function buildShuffledQueue(tracks: readonly TrackView[], firstTrackId: string): TrackView[] {
  const first = tracks.find((track) => track.id === firstTrackId);

  if (first === undefined) {
    return [...tracks];
  }

  return [first, ...shuffled(tracks.filter((track) => track.id !== firstTrackId))];
}

/**
 * The playing queue and everything the dock shows.
 *
 * The audio element lives behind [`AudioEngine`]: the store only knows the state, which
 * keeps it testable and lets the browser build fail loudly instead of silently.
 */
export const usePlayerStore = defineStore('player', () => {
  const queue = ref<TrackView[]>([]);
  const sourceQueue = ref<TrackView[]>([]);
  const index = ref(-1);
  const isExpanded = ref(false);
  const isPlaying = ref(false);
  const isLoading = ref(false);
  const isShuffleEnabled = ref(false);
  const isRepeatOneEnabled = ref(false);
  const coverAccent = ref<CoverAccent | null>(null);
  const position = ref(0);
  const duration = ref(0);
  const volume = ref(DEFAULT_VOLUME);
  const volumeBeforeMute = ref(DEFAULT_VOLUME);
  /** Which track the engine has already opened ahead of time, if any. */
  const preloadedId = ref<string | null>(null);
  const isMuted = ref(false);
  const errorKey = ref<PlayerErrorKey>(null);

  let engine: AudioEngine | null = null;

  const currentTrack = computed<TrackView | null>(() => queue.value[index.value] ?? null);
  const isActive = computed(() => currentTrack.value !== null);
  const hasNext = computed(
    () =>
      currentTrack.value !== null &&
      (isRepeatOneEnabled.value || index.value < queue.value.length - 1),
  );
  const hasPrevious = computed(() => index.value > 0);
  const progress = computed(() => (duration.value > 0 ? position.value / duration.value : 0));

  function fail(key: Exclude<PlayerErrorKey, null>) {
    playbackAllowed = false;
    cancelPreload();
    errorKey.value = key;
    isPlaying.value = false;
    isLoading.value = false;
  }

  // File reads may finish out of order; only the latest playback request owns the engine.
  let playbackRequest = 0;
  let preloadRequest = 0;
  let loadedTrackId: string | null = null;
  let playbackAllowed = false;

  function cancelPreload() {
    preloadRequest += 1;
    preloadedId.value = null;
    engine?.cancelPreload();
  }

  function ensureEngine(): AudioEngine {
    if (engine === null) {
      engine = createAudioEngine({
        onProgress: (value) => {
          position.value = value;

          if (duration.value - value <= PRELOAD_LEAD_SECONDS) {
            void preloadNext();
          }
        },
        onDuration: (value) => {
          duration.value = value;
        },
        onPlayingChange: (value) => {
          isPlaying.value = value;
        },
        onEnded: () => {
          // The engine has no use for the result: moving on reports its own failures.
          next();
        },
        onError: (kind) => {
          fail(kind);
        },
      });
      engine.setVolume(volume.value);
    }

    return engine;
  }

  /** Loads the current track and starts it; the file is granted access one play at a time. */
  async function start(at = 0, shouldPlay = true) {
    const track = currentTrack.value;

    if (track === null) {
      return;
    }

    const request = ++playbackRequest;
    playbackAllowed = false;
    if (loadedTrackId !== track.id) {
      engine?.pause();
    }
    loadedTrackId = null;
    preloadRequest += 1;
    isPlaying.value = false;
    position.value = at;
    duration.value = track.durationMs / 1000;
    errorKey.value = null;
    preloadedId.value = null;

    if (track.missing) {
      fail('missing');
      return;
    }

    isLoading.value = true;

    try {
      const source = await playbackSource(track);
      if (request !== playbackRequest) {
        return;
      }
      const audio = ensureEngine();
      audio.setTrackGain(source.gainDb);
      audio.load(source.url);
      loadedTrackId = track.id;
      playbackAllowed = shouldPlay;
      if (at > 0) {
        audio.seek(at);
      }
      if (shouldPlay) {
        await audio.play();
      }
      if (request !== playbackRequest) {
        return;
      }
      isLoading.value = false;
    } catch (error) {
      if (request !== playbackRequest) {
        return;
      }
      fail(error instanceof ShellUnavailableError ? 'shellUnavailable' : 'generic');
    }
  }

  /** Plays one track, using the given list as the queue for previous and next. */
  async function playFrom(tracks: readonly TrackView[], trackId: string) {
    const start_ = tracks.findIndex((track) => track.id === trackId);

    if (start_ < 0) {
      return;
    }

    sourceQueue.value = [...tracks];
    queue.value = isShuffleEnabled.value ? buildShuffledQueue(tracks, trackId) : [...tracks];
    index.value = isShuffleEnabled.value ? 0 : start_;

    await start();
  }

  async function play(track: TrackView) {
    await playFrom([track], track.id);
  }

  async function updateRenamedTrack(track: TrackView) {
    const current = currentTrack.value?.id === track.id;
    const at = position.value;
    const playing = isPlaying.value;
    cancelPreload();
    queue.value = queue.value.map((item) => (item.id === track.id ? track : item));
    sourceQueue.value = sourceQueue.value.map((item) => (item.id === track.id ? track : item));
    if (current) {
      playbackRequest += 1;
      engine?.release();
      engine = null;
      loadedTrackId = null;
      await start(at, playing);
    }
  }

  async function resume() {
    if (currentTrack.value === null) {
      return;
    }

    if (engine === null || loadedTrackId !== currentTrack.value.id) {
      await start();
      return;
    }

    errorKey.value = null;
    const request = ++playbackRequest;
    playbackAllowed = true;

    try {
      await engine.play();
    } catch {
      if (request === playbackRequest) {
        fail('generic');
      }
    }
  }

  function pause() {
    playbackAllowed = false;
    playbackRequest += 1;
    isLoading.value = false;
    cancelPreload();
    engine?.pause();
    isPlaying.value = false;
  }

  async function toggle() {
    if (isPlaying.value) {
      pause();
      return;
    }

    await resume();
  }

  /** Stops without unloading: the track stays in the dock, ready to start over. */
  function stop() {
    pause();
    engine?.seek(0);
    isPlaying.value = false;
    position.value = 0;
  }

  /**
   * Opens the file of the next track while the current one plays out.
   *
   * Once per track: the id of what has been opened is remembered, so the progress events
   * arriving several times a second do not each start a fetch of their own.
   */
  async function preloadNext() {
    if (!playbackAllowed || duration.value <= 0) {
      return;
    }
    const upcoming = isRepeatOneEnabled.value ? null : (queue.value[index.value + 1] ?? null);

    if (upcoming === null || upcoming.missing || preloadedId.value === upcoming.id) {
      return;
    }

    preloadedId.value = upcoming.id;
    const request = ++preloadRequest;

    try {
      const source = await playbackSource(upcoming);
      if (request !== preloadRequest) {
        return;
      }
      engine?.preload(source.url);
    } catch {
      // Nothing to report: the track will simply be opened when it is its turn.
      if (request === preloadRequest) {
        preloadedId.value = null;
      }
    }
  }

  async function next() {
    if (isRepeatOneEnabled.value && currentTrack.value !== null) {
      await start();
      return;
    }

    if (!hasNext.value) {
      stop();
      return;
    }

    index.value += 1;
    await start();
  }

  async function previous() {
    if (position.value > RESTART_THRESHOLD_SECONDS || !hasPrevious.value) {
      seek(0);
      return;
    }

    index.value -= 1;
    await start();
  }

  function seek(seconds: number) {
    if (!Number.isFinite(seconds)) {
      return;
    }
    const target = clamp(seconds, 0, duration.value);
    position.value = target;
    engine?.seek(target);
  }

  function setVolume(value: number) {
    if (!Number.isFinite(value)) {
      return;
    }
    volume.value = clamp(value, 0, 1);
    isMuted.value = volume.value === 0;
    engine?.setVolume(volume.value);
  }

  /** Silences the playback without stopping it, and remembers the level to come back to. */
  function toggleMute() {
    if (isMuted.value) {
      setVolume(volumeBeforeMute.value === 0 ? DEFAULT_VOLUME : volumeBeforeMute.value);
      return;
    }

    volumeBeforeMute.value = volume.value;
    setVolume(0);
  }

  function toggleShuffle() {
    cancelPreload();
    isShuffleEnabled.value = !isShuffleEnabled.value;

    const track = currentTrack.value;

    if (track === null) {
      return;
    }

    const orderedQueue = sourceQueue.value.length > 0 ? sourceQueue.value : queue.value;
    queue.value = isShuffleEnabled.value
      ? buildShuffledQueue(orderedQueue, track.id)
      : [...orderedQueue];
    index.value = queue.value.findIndex((item) => item.id === track.id);
  }

  function toggleRepeatOne() {
    cancelPreload();
    isRepeatOneEnabled.value = !isRepeatOneEnabled.value;
  }

  function setCoverAccent(accent: CoverAccent | null) {
    coverAccent.value = accent;
  }

  function close() {
    playbackAllowed = false;
    loadedTrackId = null;
    playbackRequest += 1;
    cancelPreload();
    engine?.release();
    engine = null;
    queue.value = [];
    sourceQueue.value = [];
    index.value = -1;
    isExpanded.value = false;
    isPlaying.value = false;
    isLoading.value = false;
    position.value = 0;
    duration.value = 0;
    errorKey.value = null;
    coverAccent.value = null;
  }

  function expand() {
    isExpanded.value = true;
  }

  function collapse() {
    isExpanded.value = false;
  }

  onScopeDispose(close);

  function toggleExpanded() {
    isExpanded.value = !isExpanded.value;
  }

  return {
    queue,
    sourceQueue,
    index,
    isExpanded,
    isPlaying,
    isLoading,
    isShuffleEnabled,
    isRepeatOneEnabled,
    coverAccent,
    position,
    duration,
    volume,
    isMuted,
    errorKey,
    currentTrack,
    isActive,
    hasNext,
    hasPrevious,
    progress,
    playFrom,
    play,
    updateRenamedTrack,
    resume,
    pause,
    toggle,
    stop,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeatOne,
    setCoverAccent,
    close,
    expand,
    collapse,
    toggleExpanded,
  };
});
