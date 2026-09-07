<script setup lang="ts">
/**
 * Counterpart of the playing bubble for a track whose file is gone: the same corner
 * notation, in the alert colour, so both states read from the edge of a card instead of
 * taking a line of its body.
 *
 * The parent has to be positioned for the bubble to land on its corner.
 */
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';

const { t } = useI18n();
</script>

<template>
  <span class="missing_bubble" :title="t('library.row.missing')" data-testid="missing-bubble">
    <AppIcon name="warning" :label="t('library.row.missing')" />
  </span>
</template>

<style scoped lang="scss">
.missing_bubble {
  display: inline-flex;
  position: absolute;
  top: $space_sm;
  left: $space_sm;
  z-index: 2;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background-color: var(--color_danger);
  box-shadow: var(--shadow_raised);
  color: var(--color_on_danger);
  font-size: 0.75em;
}
</style>
