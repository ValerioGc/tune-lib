import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAudioEngine,
  gainFactor,
  perceivedVolume,
  type AudioEngineHandlers,
} from '@/services/audio-engine';

const elements: HTMLAudioElement[] = [];
const originalAudio = window.Audio;

function handlers(): AudioEngineHandlers {
  return {
    onProgress: vi.fn(),
    onDuration: vi.fn(),
    onPlayingChange: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
  };
}

/** jsdom has no media pipeline: the element is real, playback is stubbed. */
function lastElement(): HTMLAudioElement {
  const element = elements.at(-1);

  if (element === undefined) {
    throw new Error('no audio element created');
  }

  return element;
}

beforeEach(() => {
  window.Audio = class extends originalAudio {
    constructor() {
      super();
      elements.push(this as unknown as HTMLAudioElement);
    }
  } as unknown as typeof Audio;

  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
});

afterEach(() => {
  window.Audio = originalAudio;
  elements.length = 0;
  vi.restoreAllMocks();
});

describe('createAudioEngine', () => {
  it('cancels standby downloads and detaches callbacks on release', () => {
    const callbacks = handlers();
    const engine = createAudioEngine(callbacks);
    const active = lastElement();
    engine.preload('track://next.wav');
    const standby = lastElement();
    engine.cancelPreload();
    expect(standby.hasAttribute('src')).toBe(false);
    expect(standby.load).toHaveBeenCalled();
    engine.release();
    active.dispatchEvent(new Event('ended'));
    active.dispatchEvent(new Event('timeupdate'));
    expect(callbacks.onEnded).not.toHaveBeenCalled();
    expect(callbacks.onProgress).not.toHaveBeenCalled();
  });

  it('keeps non-finite controls out of the media element', () => {
    const engine = createAudioEngine(handlers());
    engine.setVolume(Number.NaN);
    expect(lastElement().volume).toBe(0);
    engine.seek(Number.POSITIVE_INFINITY);
    expect(lastElement().currentTime).toBe(0);
    Object.defineProperty(lastElement(), 'duration', { value: 10 });
    engine.seek(20);
    expect(lastElement().currentTime).toBe(10);
  });
  it('loads a source and starts it', async () => {
    const engine = createAudioEngine(handlers());

    engine.load('asset://track.mp3');
    await engine.play();

    expect(lastElement().src).toContain('track.mp3');
    expect(lastElement().play).toHaveBeenCalledTimes(1);
  });

  it('reports progress, duration, and playback state', () => {
    const callbacks = handlers();
    createAudioEngine(callbacks);
    const element = lastElement();

    Object.defineProperty(element, 'currentTime', { value: 12.5, configurable: true });
    Object.defineProperty(element, 'duration', { value: 180, configurable: true });
    element.dispatchEvent(new Event('timeupdate'));
    element.dispatchEvent(new Event('durationchange'));
    element.dispatchEvent(new Event('play'));
    element.dispatchEvent(new Event('pause'));

    expect(callbacks.onProgress).toHaveBeenCalledWith(12.5);
    expect(callbacks.onDuration).toHaveBeenCalledWith(180);
    expect(callbacks.onPlayingChange).toHaveBeenNthCalledWith(1, true);
    expect(callbacks.onPlayingChange).toHaveBeenNthCalledWith(2, false);
  });

  it('treats a non-finite duration as unknown', () => {
    const callbacks = handlers();
    createAudioEngine(callbacks);
    const element = lastElement();

    Object.defineProperty(element, 'duration', { value: Number.NaN, configurable: true });
    element.dispatchEvent(new Event('durationchange'));

    expect(callbacks.onDuration).toHaveBeenCalledWith(0);
  });

  it('reports the end of the track', () => {
    const callbacks = handlers();
    createAudioEngine(callbacks);

    lastElement().dispatchEvent(new Event('ended'));

    expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
  });

  it('distinguishes unsupported format from other errors', () => {
    const callbacks = handlers();
    createAudioEngine(callbacks);
    const element = lastElement();

    Object.defineProperty(element, 'error', { value: { code: 4 }, configurable: true });
    element.dispatchEvent(new Event('error'));
    Object.defineProperty(element, 'error', { value: { code: 2 }, configurable: true });
    element.dispatchEvent(new Event('error'));

    expect(callbacks.onError).toHaveBeenNthCalledWith(1, 'unsupported');
    expect(callbacks.onError).toHaveBeenNthCalledWith(2, 'generic');
  });

  it('seeks, and applies the slider volume linearly', () => {
    const engine = createAudioEngine(handlers());

    engine.seek(42);
    engine.setVolume(0.5);

    expect(lastElement().currentTime).toBe(42);
    expect(lastElement().volume).toBeCloseTo(0.5);
  });

  it.each([0, 0.25, 0.5, 0.75, 1])(
    'preserves volume %s across preloaded tracks and gain changes',
    (volume) => {
      const engine = createAudioEngine(handlers());
      engine.setVolume(volume);
      expect(lastElement().volume).toBeCloseTo(volume);

      engine.setTrackGain(-20);
      expect(lastElement().volume).toBeCloseTo(volume * 0.1);

      engine.preload('track://next.mp3');
      engine.load('track://next.mp3');
      expect(lastElement().volume).toBeCloseTo(volume * 0.1);

      engine.setTrackGain(null);
      expect(lastElement().volume).toBeCloseTo(volume);
    },
  );

  it('turns a loud master down by what its own tags ask for', () => {
    const engine = createAudioEngine(handlers());

    engine.setVolume(1);
    engine.setTrackGain(-6);

    // Six decibels down is half the amplitude, near enough.
    expect(lastElement().volume).toBeCloseTo(0.501, 2);

    engine.setTrackGain(null);
    expect(lastElement().volume).toBe(1);
  });

  it('never turns anything up: an element cannot play louder than its source', () => {
    expect(gainFactor(6)).toBe(1);
    expect(gainFactor(null)).toBe(1);
    expect(gainFactor(Number.NaN)).toBe(1);
    expect(gainFactor(-20)).toBeCloseTo(0.1);
  });

  it('keeps the ends of the slider where they belong', () => {
    expect(perceivedVolume(0)).toBe(0);
    expect(perceivedVolume(1)).toBe(1);
    expect(perceivedVolume(-1)).toBe(0);
    expect(perceivedVolume(4)).toBe(1);
  });

  it('plays the file it opened ahead of time instead of opening it again', () => {
    const engine = createAudioEngine(handlers());
    const first = lastElement();

    engine.preload('track://next.mp3');
    const standby = lastElement();
    expect(standby).not.toBe(first);
    expect(standby.src).toBe('track://next.mp3');

    engine.load('track://next.mp3');

    // No new element and no second load: the one already buffered took over.
    expect(lastElement()).toBe(standby);
    expect(first.getAttribute('src')).toBeNull();
  });

  it('reports the events of whichever element is playing', () => {
    const callbacks = handlers();
    const engine = createAudioEngine(callbacks);

    engine.preload('track://next.mp3');
    engine.load('track://next.mp3');
    lastElement().dispatchEvent(new Event('ended'));

    expect(callbacks.onEnded).toHaveBeenCalledTimes(1);
  });

  it('opens nothing twice, and nothing that is already playing', () => {
    const engine = createAudioEngine(handlers());
    engine.load('track://one.mp3');
    const created = elements.length;

    engine.preload('track://two.mp3');
    engine.preload('track://two.mp3');

    expect(elements.length).toBe(created + 1);
  });

  it('releases the source when the player is closed', () => {
    const engine = createAudioEngine(handlers());
    engine.load('asset://track.mp3');

    engine.release();

    expect(lastElement().pause).toHaveBeenCalled();
    expect(lastElement().hasAttribute('src')).toBe(false);
  });
});
