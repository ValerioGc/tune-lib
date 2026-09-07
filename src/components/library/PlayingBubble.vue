<script setup lang="ts">
/**
 * Notification style: the playing state reads from the corner of a card instead of taking
 * a line of its body, which is short on every card that shows one.
 *
 * The parent has to be positioned for the bubble to land on its corner.
 */
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';

const { t } = useI18n();
</script>

<template>
  <span class="playing_bubble" :title="t('library.row.playing')" data-testid="playing-bubble">
    <AppIcon name="play" :label="t('library.row.playing')" />
  </span>
</template>

<style scoped lang="scss">
.playing_bubble {
  display: inline-flex;
  position: absolute;
  top: $space_sm;
  right: $space_sm;
  z-index: 2;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background-color: var(--color_accent);
  box-shadow: var(--shadow_raised);
  color: var(--color_on_accent);
  font-size: 0.7em;
  transition: opacity $duration_fast ease;
}
</style>
