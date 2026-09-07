<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import PlayerVolume from '@/components/player/controls/PlayerVolume.vue';

const props = withDefaults(
  defineProps<{
    volume: number;
    muted: boolean;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  stop: [];
  'toggle-mute': [];
  'update:volume': [value: number];
}>();

const { t } = useI18n();
</script>

<template>
  <!-- Stop ends the playback instead of suspending it, and the volume is not part of the
       transport either: both stay out of the group built around play. -->
  <div class="player_side_controls">
    <AppTooltip :text="t('player.stop')" align="center">
      <AppButton
        variant="ghost"
        class="player_side_controls_stop"
        :aria-label="t('player.stop')"
        :disabled="props.disabled"
        data-testid="player-stop"
        @click="emit('stop')"
      >
        <AppIcon name="stop" />
      </AppButton>
    </AppTooltip>

    <AppTooltip :text="props.muted ? t('player.unmute') : t('player.mute')" align="center">
      <AppButton
        variant="ghost"
        class="player_side_controls_mute"
        :class="{ player_side_controls_mute_on: props.muted }"
        :aria-label="props.muted ? t('player.unmute') : t('player.mute')"
        :aria-pressed="props.muted"
        data-testid="player-mute"
        @click="emit('toggle-mute')"
      >
        <AppIcon :name="props.muted ? 'mute' : 'volume'" />
      </AppButton>
    </AppTooltip>

    <PlayerVolume :model-value="props.volume" @update:model-value="emit('update:volume', $event)" />
  </div>
</template>

<style scoped lang="scss">
.player_side_controls {
  display: flex;
  flex: 0 0 auto;
  gap: $space_sm;
  align-items: center;

  &_stop,
  &_mute {
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    border-radius: 999px;
    color: var(--color_text_muted);
    font-size: 0.75em;
  }

  &_mute_on {
    color: var(--color_accent);
  }
}
</style>
