<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue';

import PlayerBar from '@/components/player/layout/PlayerBar.vue';
import { isWindowVisible } from '@/composables/useForeground';
import { miniPlayerConnected } from '@/services/mini-player-bridge';
import { dominantCoverAccent } from '@/services/cover-accent';
import { useLibraryStore } from '@/stores/library';
import { useNavigationStore } from '@/stores/navigation';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

const PlayerFullView = defineAsyncComponent(
  () => import('@/components/player/layout/PlayerFullView.vue'),
);

const library = useLibraryStore();
const navigation = useNavigationStore();
const player = usePlayerStore();
const settings = useSettingsStore();

/**
 * The player is part of the library, not of the pages read over it: settings and help take
 * the whole window, so the dock steps aside there. Only the view goes: the engine lives in
 * the store and keeps playing.
 */
const isCovered = computed(() => navigation.isSettings || navigation.isHelp);

watch(isCovered, (covered) => {
  if (covered) {
    player.collapse();
  }
});

let accentRequest = 0;
let lastAccentKey = '';

watch(
  [
    () => player.currentTrack,
    () => settings.coverGradientEnabled,
    () => settings.miniPlayerGradient,
    () => settings.coverGradientIntensity,
    () => settings.coverGradientStyle,
    () => settings.coverGradientDirection,
    () => isWindowVisible.value || miniPlayerConnected.value,
  ],
  async ([track, enabled, miniEnabled, intensity, style, direction, visible]) => {
    const request = ++accentRequest;

    if ((!enabled && !miniEnabled) || track === null || track.missing) {
      player.setCoverAccent(null);
      lastAccentKey = '';
      return;
    }

    const source = library.coverUrl(track);
    const key = JSON.stringify([source, intensity, style, direction]);

    if (!visible || (key === lastAccentKey && player.coverAccent !== null)) {
      if (key !== lastAccentKey) {
        player.setCoverAccent(null);
      }
      return;
    }
    player.setCoverAccent(null);

    if (request !== accentRequest || source === null) {
      return;
    }

    const accent = await dominantCoverAccent(source, { intensity, style, direction });

    if (request === accentRequest) {
      lastAccentKey = key;
      player.setCoverAccent(accent);
    }
  },
  { immediate: true },
);

function openLibraryFromPlayer() {
  navigation.go('library');
  player.collapse();
}

function closePlayer() {
  // Closing is always definitive. The full view has a separate collapse command for
  // returning to the minimized player without stopping the current track.
  player.close();

  if (navigation.isPlayer) {
    navigation.go('library');
  }
}
</script>

<template>
  <!-- Nothing is shown until a track is loaded: the dock only exists while playing. -->
  <template v-if="player.currentTrack !== null && !isCovered">
    <PlayerFullView
      v-if="player.isExpanded"
      :track="player.currentTrack"
      :show-library-link="navigation.isPlayer"
      @collapse="player.collapse()"
      @open-library="openLibraryFromPlayer"
      @close="closePlayer"
    />
    <PlayerBar v-else :track="player.currentTrack" @expand="player.expand()" @close="closePlayer" />
  </template>
</template>
