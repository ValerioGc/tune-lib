<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';

const props = withDefaults(
  defineProps<{
    isPlaying: boolean;
    hasNext: boolean;
    isShuffleEnabled: boolean;
    isRepeatOneEnabled: boolean;
    disabled?: boolean;
    prominent?: boolean;
  }>(),
  { disabled: false, prominent: false },
);

const emit = defineEmits<{
  previous: [];
  toggle: [];
  next: [];
  toggleShuffle: [];
  toggleRepeatOne: [];
}>();

const { t } = useI18n();
</script>

<template>
  <!-- Play sits in the middle with previous and next around it, and the two queue modes
       at the ends: the group reads symmetrically from its centre. -->
  <div class="player_controls" :class="{ player_controls_prominent: props.prominent }">
    <AppTooltip :text="t('player.shuffle')" align="center">
      <AppButton
        variant="ghost"
        class="player_controls_mode"
        :class="{ player_controls_mode_active: props.isShuffleEnabled }"
        :aria-label="t('player.shuffle')"
        :aria-pressed="props.isShuffleEnabled"
        :disabled="props.disabled"
        data-testid="player-shuffle"
        @click="emit('toggleShuffle')"
      >
        <AppIcon name="shuffle" />
      </AppButton>
    </AppTooltip>

    <!-- Previous stays enabled on the first track: it restarts what is playing. -->
    <AppTooltip :text="t('player.previous')" align="center">
      <AppButton
        variant="ghost"
        class="player_controls_step"
        :aria-label="t('player.previous')"
        :disabled="props.disabled"
        data-testid="player-previous"
        @click="emit('previous')"
      >
        <AppIcon name="previous" />
      </AppButton>
    </AppTooltip>

    <AppTooltip :text="props.isPlaying ? t('player.pause') : t('player.play')" align="center">
      <AppButton
        variant="primary"
        class="player_controls_toggle"
        :aria-label="props.isPlaying ? t('player.pause') : t('player.play')"
        :aria-pressed="props.isPlaying"
        :disabled="props.disabled"
        data-testid="player-toggle"
        @click="emit('toggle')"
      >
        <AppIcon :name="props.isPlaying ? 'pause' : 'play'" />
      </AppButton>
    </AppTooltip>

    <AppTooltip :text="t('player.next')" align="center">
      <AppButton
        variant="ghost"
        class="player_controls_step"
        :aria-label="t('player.next')"
        :disabled="props.disabled || !props.hasNext"
        data-testid="player-next"
        @click="emit('next')"
      >
        <AppIcon name="next" />
      </AppButton>
    </AppTooltip>

    <AppTooltip :text="t('player.repeatOne')" align="center">
      <AppButton
        variant="ghost"
        class="player_controls_mode"
        :class="{ player_controls_mode_active: props.isRepeatOneEnabled }"
        :aria-label="t('player.repeatOne')"
        :aria-pressed="props.isRepeatOneEnabled"
        :disabled="props.disabled"
        data-testid="player-repeat-one"
        @click="emit('toggleRepeatOne')"
      >
        <AppIcon name="repeatOne" />
      </AppButton>
    </AppTooltip>
  </div>
</template>

<style scoped lang="scss">
.player_controls {
  display: flex;
  gap: $space_xs;
  align-items: center;

  &_mode {
    color: var(--color_text_muted);

    &_active {
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
    }
  }

  &_toggle {
    width: 2.75rem;
    height: 2.25rem;
    padding: 0;
    border-radius: 999px;
  }

  &_step {
    padding: $space_sm;
  }

  &_prominent {
    gap: $space_sm;

    .player_controls_toggle {
      width: 3.5rem;
      height: 3rem;
      font-size: 1.15em;
    }

    .player_controls_mode,
    .player_controls_step {
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      border-radius: 999px;
      font-size: 1.05em;
    }
  }
}
</style>
