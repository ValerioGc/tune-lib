<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import { openDefaultAudioPlayerSettings } from '@/services/default-player';
import { currentPlatform } from '@/services/platform';

const { t } = useI18n();
const isOpening = ref(false);
const failed = ref(false);

/**
 * Only Windows has a page to send the user to. On Linux the association lives in the
 * desktop environment, which has no address the app can open, so the way to it is written
 * out instead.
 */
const platform = computed(() => currentPlatform());

/** The command that claims the audio types for the entry the packages install. */
const linuxCommand =
  'xdg-mime default tunelib.desktop audio/mpeg audio/flac audio/ogg audio/x-wav audio/mp4';

async function openSettings() {
  isOpening.value = true;
  failed.value = false;

  const opened = await openDefaultAudioPlayerSettings();
  failed.value = !opened;
  isOpening.value = false;
}
</script>

<template>
  <div class="default_player_panel">
    <template v-if="platform === 'linux'">
      <p class="default_player_panel_text" data-testid="default-player-linux">
        {{ t('settings.defaultPlayer.linuxMessage') }}
      </p>
      <code class="default_player_panel_command">{{ linuxCommand }}</code>
    </template>

    <template v-else>
      <p class="default_player_panel_text">
        {{ t('settings.defaultPlayer.message') }}
      </p>
      <AppButton
        variant="primary"
        :disabled="isOpening"
        data-testid="default-player-open"
        @click="openSettings"
      >
        {{ isOpening ? t('settings.defaultPlayer.opening') : t('settings.defaultPlayer.open') }}
      </AppButton>
      <p v-if="failed" class="default_player_panel_error" role="alert">
        {{ t('settings.defaultPlayer.error') }}
      </p>
    </template>
  </div>
</template>

<style scoped lang="scss">
.default_player_panel {
  display: flex;
  flex-wrap: wrap;
  gap: $space_md;
  align-items: center;

  &_text {
    flex: 1;
    min-width: 14rem;
    color: var(--color_text_muted);
  }

  // A line to be copied: it is one of the few things here worth selecting.
  &_command {
    @include selectable_text;

    flex: 1 0 100%;
    padding: $space_sm $space_md;
    overflow-x: auto;
    border-radius: $radius_sm;
    background-color: var(--color_surface_alt);
    color: var(--color_text);
    font-family: $font_family_mono;
    font-size: 0.8125em;
    white-space: nowrap;
  }

  &_error {
    flex: 1 0 100%;
    color: var(--color_text);
  }
}
</style>
