<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppSlider from '@/components/common/input/AppSlider.vue';
import { formatDuration } from '@/services/track-sorting';

const props = withDefaults(
  defineProps<{
    position: number;
    duration: number;
    /** For the places too small to spell the times out, like the floating dock. */
    hideTimes?: boolean;
  }>(),
  { hideTimes: false },
);

const emit = defineEmits<{ seek: [seconds: number] }>();

const { t } = useI18n();

const elapsed = computed(() => formatDuration(props.position * 1000));
const total = computed(() => formatDuration(props.duration * 1000));
/** With an unknown length the bar has nothing to point at, so seeking is disabled. */
const isSeekable = computed(() => props.duration > 0);
</script>

<template>
  <div class="player_progress">
    <span v-if="!props.hideTimes" class="player_progress_time" data-testid="player-position">{{
      elapsed
    }}</span>
    <AppSlider
      :model-value="props.position"
      :label="t('player.progress')"
      :max="props.duration"
      :step="1"
      :disabled="!isSeekable"
      :value-text="`${elapsed} / ${total}`"
      hide-label
      @update:model-value="emit('seek', $event)"
    />
    <span v-if="!props.hideTimes" class="player_progress_time" data-testid="player-duration">{{
      total
    }}</span>
  </div>
</template>

<style scoped lang="scss">
.player_progress {
  display: flex;
  flex: 1;
  gap: $space_sm;
  align-items: center;
  min-width: 0;

  &_time {
    color: var(--color_text_muted);
    font-size: 0.875em;
    font-variant-numeric: tabular-nums;
  }
}
</style>
