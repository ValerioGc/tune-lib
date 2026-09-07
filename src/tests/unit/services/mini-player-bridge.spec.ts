import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  miniPlayerConnected,
  onMiniPlayerClosed,
  onPlayerState,
  publishPlayerState,
  type MiniPlayerState,
} from '@/services/mini-player-bridge';

const mocks = vi.hoisted(() => ({ emit: vi.fn(), listen: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => mocks);

const state: MiniPlayerState = {
  title: 'Track',
  artist: null,
  album: null,
  year: null,
  cover: null,
  isPlaying: true,
  hasNext: false,
  hasPrevious: false,
  position: 1,
  duration: 100,
  volume: 0.8,
  isMuted: false,
  gradient: null,
};

beforeEach(() => {
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  vi.clearAllMocks();
  mocks.emit.mockResolvedValue(undefined);
});
afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  miniPlayerConnected.value = false;
});

describe('mini player updates', () => {
  it('sends only position on progress and a fresh snapshot on resynchronization', async () => {
    await publishPlayerState(state);
    await publishPlayerState({ ...state, position: 2 }, true);
    expect(mocks.emit).toHaveBeenLastCalledWith('mini://progress', 2);
    await publishPlayerState({ ...state, title: 'Next' }, true);
    expect(mocks.emit).toHaveBeenLastCalledWith('mini://state', { ...state, title: 'Next' });
    await publishPlayerState(state);
    expect(mocks.emit).toHaveBeenLastCalledWith('mini://state', state);
  });

  it('merges progress with the snapshot and releases both listeners', async () => {
    const callbacks = new Map<string, (event: { payload: unknown }) => void>();
    const stop = vi.fn();
    mocks.listen.mockImplementation(
      (event: string, callback: (event: { payload: unknown }) => void) => {
        callbacks.set(event, callback);
        return Promise.resolve(stop);
      },
    );
    const update = vi.fn();
    const unlisten = await onPlayerState(update);
    callbacks.get('mini://progress')?.({ payload: 2 });
    expect(update).not.toHaveBeenCalled();
    callbacks.get('mini://state')?.({ payload: state });
    callbacks.get('mini://progress')?.({ payload: 3 });
    expect(update).toHaveBeenLastCalledWith({ ...state, position: 3 });
    callbacks.get('mini://state')?.({ payload: null });
    callbacks.get('mini://progress')?.({ payload: 4 });
    expect(update).toHaveBeenLastCalledWith(null);
    unlisten?.();
    expect(stop).toHaveBeenCalledTimes(2);
    miniPlayerConnected.value = true;
    await onMiniPlayerClosed();
    callbacks.get('mini://closed')?.({ payload: null });
    expect(miniPlayerConnected.value).toBe(false);
  });
});
