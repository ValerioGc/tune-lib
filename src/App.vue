<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppSpinner from '@/components/common/placeholder/AppSpinner.vue';
import TitleBar from '@/components/layout/TitleBar.vue';

import { onAudioFileOpened, startupAudioFile } from '@/services/playback-api';
import {
  onMiniCommand,
  onMiniPlayerClosed,
  miniPlayerConnected,
  publishPlayerState,
  type MiniPlayerCommand,
} from '@/services/mini-player-bridge';
import { applyTrayMenu, closeMiniPlayer, onTrayStopPlayback } from '@/services/shell-integration';
import { useLibraryStore } from '@/stores/library';
import { quitApp, showWindow } from '@/services/window-controls';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
const LibraryView = defineAsyncComponent(() => import('@/views/LibraryView.vue'));
const HelpView = defineAsyncComponent(() => import('@/views/HelpView.vue'));
const SettingsView = defineAsyncComponent(() => import('@/views/SettingsView.vue'));
const PlayerDock = defineAsyncComponent(() => import('@/components/player/layout/PlayerDock.vue'));
const playerViewReady = import('@/components/player/layout/PlayerFullView.vue');

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();
const navigation = useNavigationStore();
const player = usePlayerStore();
const appInitialized = ref(false);

let dockPinned = settings.miniPlayerAlwaysOnTop;

async function writeTrayMenu(pinned = dockPinned) {
  dockPinned = pinned;
  await applyTrayMenu({
    show: t('tray.show'),
    bringToFront: t('tray.bringToFront'),
    stop: t('tray.stop'),
    quit: t('tray.quit'),
    canStop: player.isActive,
    canBringToFront: player.isActive && !pinned,
  });
}

let stopTrayListener: (() => void) | null = null;
let miniCommandListener: (() => void) | null = null;
let audioFileListener: (() => void) | null = null;
let miniClosedListener: (() => void) | null = null;

async function publishToDock(incremental = false) {
  const track = player.currentTrack;

  if (track === null) {
    await publishPlayerState(null);
    return;
  }

  await publishPlayerState(
    {
      title: track.title,
      artist: track.artist,
      album: track.album,
      year: track.year,
      cover: library.coverUrl(track),
      isPlaying: player.isPlaying,
      hasNext: player.hasNext,
      hasPrevious: player.hasPrevious,
      position: player.position,
      duration: player.duration,
      volume: player.volume,
      isMuted: player.isMuted,
      gradient:
        settings.miniPlayerGradient && player.coverAccent !== null
          ? player.coverAccent.surfaceGradient
          : null,
    },
    incremental,
  );
}

async function stopFromTray() {
  player.close();
  await closeMiniPlayer();
}

async function runDockCommand({ action, value }: MiniPlayerCommand) {
  if (action === 'toggle') {
    await player.toggle();
    return;
  }

  if (action === 'next') {
    await player.next();
    return;
  }

  if (action === 'previous') {
    await player.previous();
    return;
  }

  if (action === 'stop') {
    player.stop();
    return;
  }

  if (action === 'seek') {
    player.seek(value ?? 0);
    return;
  }

  if (action === 'volume') {
    player.setVolume(value ?? 0);
    return;
  }

  if (action === 'mute') {
    player.toggleMute();
    return;
  }

  if (action === 'expand') {
    navigation.go('library');
    player.expand();
    await closeMiniPlayer();
    await showWindow();
    navigation.go('library');
    player.expand();
    return;
  }

  if (action === 'settings') {
    await closeMiniPlayer();
    await showWindow();
    navigation.goToSettings('player');
    return;
  }

  if (action === 'sync') {
    miniPlayerConnected.value = true;
    await publishToDock();
    await writeTrayMenu(value === undefined ? undefined : value === 1);
    return;
  }

  if (action === 'quit') {
    await quitApp();
  }
}

async function openStartupAudioFile(): Promise<boolean> {
  const startupTrack = await startupAudioFile();

  if (startupTrack === null) {
    return false;
  }

  navigation.go('player');
  player.expand();
  await player.play(startupTrack);
  await playerViewReady;
  await showWindow();

  return true;
}

async function initializeApp() {
  miniClosedListener = await onMiniPlayerClosed();
  audioFileListener = await onAudioFileOpened(() => {
    openStartupAudioFile().catch((error: unknown) => {
      console.error('Opening an audio file in the running app failed', error);
    });
  });

  await settings.initialize();
  await writeTrayMenu();
  stopTrayListener = await onTrayStopPlayback(() => {
    stopFromTray().catch((error: unknown) => {
      console.error('Stopping the playback from the tray failed', error);
    });
  });
  miniCommandListener = await onMiniCommand((command) => {
    runDockCommand(command).catch((error: unknown) => {
      console.error('The dock asked for something that failed', error);
    });
  });

  const openedStartupFile = await openStartupAudioFile();
  appInitialized.value = true;

  if (!openedStartupFile && !settings.autostartMinimized) {
    await showWindow();
  }
}

onMounted(initializeApp);

watch([() => settings.locale, () => player.isActive, () => settings.miniPlayerAlwaysOnTop], () => {
  dockPinned = settings.miniPlayerAlwaysOnTop;
  writeTrayMenu();
});

watch(
  [
    () => player.currentTrack,
    () => player.isPlaying,
    () => player.hasNext,
    () => player.hasPrevious,
    () => Math.floor(player.position),
    () => player.duration,
    () => miniPlayerConnected.value,
    () => player.volume,
    () => player.isMuted,
    () => player.coverAccent,
    () => settings.miniPlayerGradient,
  ],
  () => {
    if (!miniPlayerConnected.value) {
      return;
    }
    publishToDock(true).catch((error: unknown) => {
      console.error('Telling the dock what is playing failed', error);
    });
  },
);

onBeforeUnmount(() => {
  miniClosedListener?.();
  miniPlayerConnected.value = false;
  stopTrayListener?.();
  stopTrayListener = null;
  miniCommandListener?.();
  miniCommandListener = null;
  audioFileListener?.();
  audioFileListener = null;
  settings.dispose();
});
</script>

<template>
  <div class="app_shell">
    <TitleBar />

    <main class="app_shell_content">
      <Suspense v-if="navigation.isSettings">
        <SettingsView />
        <template #fallback>
          <div class="app_shell_loading">
            <AppSpinner :label="t('settings.loading')" />
          </div>
        </template>
      </Suspense>
      <Suspense v-else-if="navigation.isHelp">
        <HelpView />
        <template #fallback>
          <div class="app_shell_loading">
            <AppSpinner :label="t('help.loading')" />
          </div>
        </template>
      </Suspense>
      <div v-else-if="navigation.isPlayer" class="app_shell_player_only"></div>
      <Suspense v-else-if="appInitialized">
        <LibraryView />
        <template #fallback>
          <div class="app_shell_loading">
            <AppSpinner size="large" :label="t('library.loading')" />
          </div>
        </template>
      </Suspense>
      <div v-else class="app_shell_loading">
        <AppSpinner size="large" :label="t('library.loading')" />
      </div>
    </main>

    <PlayerDock />
  </div>
</template>

<style scoped lang="scss">
.app_shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  // The window itself never scrolls: the shell is a fixed frame and every view scrolls
  // the region that owns its content.
  overflow: hidden;

  // The frame is fixed: the library scrolls its list, the settings and the guide scroll
  // their own content, and nothing ever moves the page under the titlebar.
  &_content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    // Keep only a small breathing room before the in-app player dock.
    padding: $page_gutter $page_gutter $space_xs;
    overflow: hidden;
  }

  &_player_only {
    flex: 1;
  }

  &_loading {
    display: grid;
    flex: 1;
    place-items: center;
  }
}
</style>
