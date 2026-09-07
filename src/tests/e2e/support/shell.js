/**
 * A stand-in for the desktop shell, installed in the page before the app boots.
 *
 * The browser suite runs the same frontend the desktop app runs, minus the shell behind it:
 * without one the library comes back empty and nothing can be played, so the flows that
 * matter most — opening a track, growing the player, sending it to the dock — cannot be
 * reached at all. This answers the handful of commands those flows ask for, keeps a note of
 * every one of them so a scenario can check what the shell was asked to do, and carries the
 * events the floating dock and the main window speak to each other with.
 */
import { Buffer } from 'node:buffer';

/** Where the fake shell serves the track and its cover from, on the app's own origin. */
const AUDIO_PATH = '/e2e-shell/track.wav';
const COVER_PATH = '/e2e-shell/cover.png';

/** Long enough that no scenario ever reaches the end of it and rolls on to the next track. */
const AUDIO_SECONDS = 600;
const SAMPLE_RATE = 8000;

export const FIXTURE_LIBRARY_NAME = 'E2E library';

export const FIXTURE_TRACKS = [
  {
    id: 'track-1',
    path: 'C:/e2e/night-shift/midnight-ride.mp3',
    title: 'Midnight Ride',
    artist: 'The Static Owls',
    album: 'Night Shift',
    year: 2019,
    genre: 'Rock',
    durationMs: 183_000,
    format: 'mp3',
    hasCover: true,
    addedAt: 1_700_000_000,
    missing: false,
  },
  {
    id: 'track-2',
    path: 'C:/e2e/night-shift/paper-lanterns.mp3',
    title: 'Paper Lanterns',
    artist: 'The Static Owls',
    album: 'Night Shift',
    year: 2019,
    genre: 'Rock',
    durationMs: 205_000,
    format: 'mp3',
    hasCover: true,
    addedAt: 1_700_000_100,
    missing: false,
  },
  {
    id: 'track-3',
    path: 'C:/e2e/blue-hour/coastal-signal.flac',
    title: 'Coastal Signal',
    artist: 'Marta Vela',
    album: 'Blue Hour',
    year: 2021,
    genre: 'Ambient',
    durationMs: 241_000,
    format: 'flac',
    hasCover: false,
    addedAt: 1_700_000_200,
    missing: false,
  },
];

/** Unsigned 8 bit silence in a RIFF container: decodable, and cheap to build. */
function silentWav(seconds) {
  const dataLength = SAMPLE_RATE * seconds;
  // 128 is the middle of the unsigned 8 bit range, which is silence rather than a click.
  const file = Buffer.alloc(44 + dataLength, 128);

  file.write('RIFF', 0, 'ascii');
  file.writeUInt32LE(36 + dataLength, 4);
  file.write('WAVE', 8, 'ascii');
  file.write('fmt ', 12, 'ascii');
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(1, 22);
  file.writeUInt32LE(SAMPLE_RATE, 24);
  file.writeUInt32LE(SAMPLE_RATE, 28);
  file.writeUInt16LE(1, 32);
  file.writeUInt16LE(8, 34);
  file.write('data', 36, 'ascii');
  file.writeUInt32LE(dataLength, 40);

  return file;
}

/** A single opaque pixel: enough for a cover to load and for its colour to be read. */
const COVER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const AUDIO_WAV = silentWav(AUDIO_SECONDS);

/**
 * Runs inside the page, before anything of the app does.
 *
 * Everything it needs is handed over in `data`: the function is serialized on the way in,
 * so it can hold nothing of the module around it.
 */
function shellRuntime(data) {
  const channel = data.desktop ? new BroadcastChannel('e2e-shell-events') : null;
  const calls = [];
  const dockCommands = [];
  const callbacks = new Map();
  /** Event name to the listeners registered for it, as `eventId -> callbackId`. */
  const listeners = new Map();
  /** Store id to its contents, so the settings written by the app are read back. */
  const stores = new Map();
  const storeIds = new Map();

  let nextCallbackId = 1;
  let nextEventId = 1;
  let nextStoreId = 1;

  function emitEvent(event, payload, broadcast = true) {
    if (broadcast) {
      channel?.postMessage({ event, payload });
    }
    const registered = listeners.get(event);

    if (registered === undefined) {
      return;
    }

    for (const [eventId, callbackId] of [...registered]) {
      callbacks.get(callbackId)?.({ event, id: eventId, payload });
    }
  }
  if (channel) {
    channel.onmessage = ({ data: message }) => emitEvent(message.event, message.payload, false);
  }

  const shell = {
    calls,
    dockCommands,
    listenerCount: () =>
      [...listeners.values()].reduce((count, registered) => count + registered.size, 0),
    dispatch: emitEvent,
    /** Whether the shell has a window of its own to ask the closing question in. */
    opensConfirmationWindow: false,
    /** What the main window says it is playing, as the dock is told it. */
    playerState: data.playerState,
    publish: (state) => {
      shell.playerState = state;
      emitEvent('mini://state', state);
    },
  };

  function trackOf(id) {
    return data.tracks.find((track) => track.id === id) ?? null;
  }

  function storeFor(rid) {
    let contents = stores.get(rid);

    if (contents === undefined) {
      contents = new Map();
      stores.set(rid, contents);
    }

    return contents;
  }

  /**
   * The dock talks to the main window, which is a window this suite does not have. What that
   * window would answer is answered here: a snapshot on request, and the playing state kept
   * in step with the transport buttons.
   */
  function answerDockCommand(command) {
    const { action, value } = command ?? {};
    dockCommands.push({ action, value: value ?? null });

    if (action === 'sync') {
      emitEvent('mini://state', shell.playerState);
      return;
    }

    if (shell.playerState === null) {
      return;
    }

    if (action === 'toggle') {
      shell.publish({ ...shell.playerState, isPlaying: !shell.playerState.isPlaying });
      return;
    }

    if (action === 'mute') {
      shell.publish({ ...shell.playerState, isMuted: !shell.playerState.isMuted });
    }
  }

  const commands = {
    library_info: () => ({
      name: data.libraryName,
      metadata: {
        artists: [...new Set(data.tracks.map((track) => track.artist))],
        albums: [...new Set(data.tracks.map((track) => track.album))],
        genres: [...new Set(data.tracks.map((track) => track.genre))],
        artistArtwork: [],
        genreArtwork: [],
      },
    }),
    list_tracks: () => data.tracks,
    list_libraries: () => [
      { id: 'library-1', name: data.libraryName, trackCount: data.tracks.length, active: true },
    ],
    refresh_library_from_disk: () => ({ refreshed: 0, missing: [] }),
    refresh_track: ({ id }) => trackOf(id),
    verify_track_file: ({ id }) => trackOf(id),
    prepare_playback: () => ({ path: data.audioPath, gainDb: null }),
    prepare_external_playback: () => ({ path: data.audioPath, gainDb: null }),
    startup_audio_file: () => null,
    is_default_audio_player: () => true,
    heavy_cover_bytes: () => null,

    // The closing question wants a window of its own. Outside the shell there is none, and
    // the dock is told so by the call failing: it then asks inside itself instead.
    open_mini_close_confirmation: () => {
      if (!shell.opensConfirmationWindow) {
        throw new Error('no window to ask the closing question in');
      }

      emitEvent('mini://close-question', true);

      return null;
    },

    'plugin:window|outer_position': () => ({ x: 120, y: 80 }),
    'plugin:window|inner_position': () => ({ x: 120, y: 80 }),
    'plugin:window|scale_factor': () => 1,

    'plugin:event|listen': ({ event, handler }) => {
      const registered = listeners.get(event) ?? new Map();
      const eventId = nextEventId++;
      registered.set(eventId, handler);
      listeners.set(event, registered);

      return eventId;
    },
    'plugin:event|unlisten': ({ event, eventId }) => {
      listeners.get(event)?.delete(eventId);

      return null;
    },
    'plugin:event|emit': ({ event, payload }) => {
      emitEvent(event, payload);

      if (event === 'mini://command' && !data.desktop) {
        answerDockCommand(payload);
      }

      return null;
    },

    'plugin:store|load': ({ path }) => {
      const rid = storeIds.get(path) ?? nextStoreId++;
      storeIds.set(path, rid);
      storeFor(rid);

      return rid;
    },
    'plugin:store|get_store': ({ path }) => storeIds.get(path) ?? null,
    'plugin:store|get': ({ rid, key }) => {
      const contents = storeFor(rid);

      return [contents.get(key) ?? null, contents.has(key)];
    },
    'plugin:store|set': ({ rid, key, value }) => {
      storeFor(rid).set(key, value);

      return null;
    },
    'plugin:store|has': ({ rid, key }) => storeFor(rid).has(key),
    'plugin:store|delete': ({ rid, key }) => storeFor(rid).delete(key),
    'plugin:store|keys': ({ rid }) => [...storeFor(rid).keys()],
    'plugin:store|values': ({ rid }) => [...storeFor(rid).values()],
    'plugin:store|entries': ({ rid }) => [...storeFor(rid).entries()],
    'plugin:store|length': ({ rid }) => storeFor(rid).size,
    'plugin:store|save': () => null,
  };

  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: data.windowLabel },
      currentWebview: { windowLabel: data.windowLabel, label: data.windowLabel },
    },
    transformCallback: (callback) => {
      const id = nextCallbackId++;
      callbacks.set(id, callback);

      return id;
    },
    unregisterCallback: (id) => {
      callbacks.delete(id);
    },
    convertFileSrc: (path, protocol) => (protocol === 'cover' ? data.coverPath : data.audioPath),
    invoke: (command, args) => {
      const payload = args ?? {};
      calls.push({ command, args: payload });

      if (
        data.desktop &&
        [
          'open_mini_player',
          'close_mini_player',
          'open_mini_close_confirmation',
          'set_mini_player_shape',
          'quit_app',
          'plugin:window|show',
          'plugin:window|hide',
          'plugin:window|close',
          'plugin:window|set_focus',
          'plugin:window|minimize',
          'plugin:window|unminimize',
        ].includes(command)
      ) {
        return window.__E2E_WINDOW__(command, payload);
      }

      try {
        const answer = commands[command];

        return Promise.resolve(answer === undefined ? null : answer(payload));
      } catch (error) {
        return Promise.reject(error);
      }
    },
  };

  // The event API takes the listener off its own books before telling the backend.
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: (event, eventId) => {
      listeners.get(event)?.delete(eventId);
    },
  };

  window.__E2E_SHELL__ = shell;
}

/** What the main window would be telling the dock while the first fixture track plays. */
function playingState(track) {
  return {
    title: track.title,
    artist: track.artist,
    album: track.album,
    year: track.year,
    cover: COVER_PATH,
    isPlaying: true,
    hasNext: true,
    hasPrevious: false,
    position: 42,
    duration: track.durationMs / 1000,
    volume: 0.8,
    isMuted: false,
    gradient: null,
  };
}

/**
 * Puts the fake shell in front of the page: the files it serves first, then the runtime,
 * which has to be in place before the app reads `__TAURI_INTERNALS__` on boot.
 */
export async function installShell(page, options = {}) {
  const audio = options.largeAudio ? silentWav(4500) : AUDIO_WAV;
  await page.route(`**${AUDIO_PATH}`, async (route) => {
    if (!options.largeAudio) {
      return route.fulfill({ contentType: 'audio/wav', body: audio });
    }
    const range = route.request().headers().range;
    options.audioRequests.push(range ?? null);
    const match = /^bytes=(\d+)-(\d*)$/.exec(range ?? '');
    if (match === null) {
      return route.fulfill({ status: 413, body: '' });
    }
    const start = Number(match[1]);
    const end = Math.min(
      match[2] ? Number(match[2]) : audio.length - 1,
      start + 1024 * 1024 - 1,
      audio.length - 1,
    );
    if (start > end) {
      return route.fulfill({
        status: 416,
        headers: { 'Content-Range': `bytes */${audio.length}` },
        body: '',
      });
    }
    return route.fulfill({
      status: 206,
      contentType: 'audio/wav',
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${audio.length}`,
        'Content-Length': String(end - start + 1),
      },
      body: audio.subarray(start, end + 1),
    });
  });
  await page.route(`**${COVER_PATH}*`, (route) =>
    route.fulfill({ contentType: 'image/png', body: COVER_PNG }),
  );

  await page.addInitScript(shellRuntime, {
    tracks: FIXTURE_TRACKS,
    libraryName: FIXTURE_LIBRARY_NAME,
    audioPath: AUDIO_PATH,
    coverPath: COVER_PATH,
    windowLabel: options.windowLabel ?? 'main',
    desktop: options.desktop ?? false,
    playerState: playingState(FIXTURE_TRACKS[0]),
  });
}

/** What the fake shell was asked to do, in the order it was asked. */
export function shellCalls(page, command) {
  return page.evaluate(
    (name) =>
      window.__E2E_SHELL__.calls
        .filter((call) => name === null || call.command === name)
        .map((call) => ({ command: call.command, args: call.args })),
    command ?? null,
  );
}

/** Waits for the shell to be asked for the command, and hands back every such call. */
export async function waitForShellCall(page, command) {
  await page.waitForFunction(
    (name) => window.__E2E_SHELL__.calls.some((call) => call.command === name),
    command,
  );

  return shellCalls(page, command);
}

/** Every command the floating dock sent to the main window. */
export function dockCommands(page) {
  return page.evaluate(() => window.__E2E_SHELL__.dockCommands);
}

/** Waits for the dock to send the main window the command, and hands back every such one. */
export async function waitForDockCommand(page, action) {
  await page.waitForFunction(
    (name) => window.__E2E_SHELL__.dockCommands.some((command) => command.action === name),
    action,
  );

  return page.evaluate(
    (name) => window.__E2E_SHELL__.dockCommands.filter((command) => command.action === name),
    action,
  );
}

/** Gives the shell a window to ask the closing question in, as the desktop app has. */
export function allowConfirmationWindow(page) {
  return page.evaluate(() => {
    window.__E2E_SHELL__.opensConfirmationWindow = true;
  });
}
