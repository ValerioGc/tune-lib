import { isTauriRuntime } from '@/config/app-config';
import { ref } from 'vue';

/** Set by the dock handshake and cleared by the native window destruction event. */
export const miniPlayerConnected = ref(false);
let lastSnapshot = '';

/** What the dock shows: the main window owns the sound and sends word of it. */
export interface MiniPlayerState {
  title: string;
  artist: string | null;
  album: string | null;
  year: number | null;
  cover: string | null;
  isPlaying: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  position: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  /** The colour taken from the cover, ready to be painted behind the dock. */
  gradient: string | null;
}

/** What the dock asks for. The main window is the one that can do any of it. */
export interface MiniPlayerCommand {
  action:
    | 'toggle'
    | 'next'
    | 'previous'
    | 'stop'
    | 'expand'
    | 'settings'
    | 'quit'
    | 'sync'
    | 'seek'
    | 'volume'
    | 'mute';
  /** Seconds for a seek, a fraction of one for the volume. */
  value?: number;
}

const STATE_EVENT = 'mini://state';
const COMMAND_EVENT = 'mini://command';
const CLOSE_QUESTION_EVENT = 'mini://close-question';

type Unlisten = () => void;

async function emitEvent(event: string, payload: unknown): Promise<boolean> {
  if (!isTauriRuntime()) {
    return false;
  }

  try {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(event, payload);

    return true;
  } catch (error) {
    console.error(`Mini player event ${event} failed`, error);

    return false;
  }
}

async function listenTo<T>(event: string, run: (payload: T) => void): Promise<Unlisten | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');

    return await listen<T>(event, (received) => run(received.payload));
  } catch (error) {
    console.error(`Mini player listener ${event} failed`, error);

    return null;
  }
}

/** Main window: says what is playing, so the dock can draw it. */
export async function publishPlayerState(
  state: MiniPlayerState | null,
  incremental = false,
): Promise<boolean> {
  const snapshot = JSON.stringify(state === null ? null : { ...state, position: 0 });
  if (incremental && state !== null && snapshot === lastSnapshot) {
    return emitEvent('mini://progress', state.position);
  }
  const sent = await emitEvent(STATE_EVENT, state);
  lastSnapshot = sent ? snapshot : '';
  return sent;
}

/** Dock: follows what the main window is playing. */
export async function onPlayerState(
  run: (state: MiniPlayerState | null) => void,
): Promise<Unlisten | null> {
  let current: MiniPlayerState | null = null;
  const stopState = await listenTo<MiniPlayerState | null>(STATE_EVENT, (state) => {
    current = state;
    run(state);
  });
  const stopProgress = await listenTo<number>('mini://progress', (position) => {
    if (current !== null && Number.isFinite(position)) {
      current = { ...current, position };
      run(current);
    }
  });
  if (stopState === null && stopProgress === null) {
    return null;
  }
  return () => {
    stopState?.();
    stopProgress?.();
  };
}

export async function onMiniPlayerClosed(): Promise<Unlisten | null> {
  return listenTo('mini://closed', () => {
    miniPlayerConnected.value = false;
  });
}

/** Dock: asks the main window for something only it can do. */
export async function sendMiniCommand(
  action: MiniPlayerCommand['action'],
  value?: number,
): Promise<boolean> {
  return emitEvent(COMMAND_EVENT, value === undefined ? { action } : { action, value });
}

/** Main window: answers the dock. */
export async function onMiniCommand(
  run: (command: MiniPlayerCommand) => void,
): Promise<Unlisten | null> {
  return listenTo<MiniPlayerCommand>(COMMAND_EVENT, (command) => {
    if (command === null || typeof command !== 'object' || typeof command.action !== 'string') {
      return;
    }
    if (command.value !== undefined && !Number.isFinite(command.value)) {
      return;
    }
    run(command);
  });
}

/** The confirmation window: says whether it is on screen, so the dock can stand back. */
export async function sendCloseQuestionOpen(open: boolean): Promise<boolean> {
  return emitEvent(CLOSE_QUESTION_EVENT, open);
}

export async function onCloseQuestionOpen(run: (open: boolean) => void): Promise<Unlisten | null> {
  return listenTo<boolean>(CLOSE_QUESTION_EVENT, run);
}
