<script setup lang="ts">
import { computed } from 'vue';

import { ICON_GLYPHS, type IconName } from '@/config/icons';

const props = withDefaults(defineProps<{ name: IconName; label?: string }>(), { label: '' });

const glyph = computed(() => ICON_GLYPHS[props.name]);
const isDecorative = computed(() => props.label === '');
</script>

<template>
  <span
    class="app_icon"
    :class="`app_icon_${name}`"
    :role="isDecorative ? undefined : 'img'"
    :aria-hidden="isDecorative ? 'true' : undefined"
    :aria-label="isDecorative ? undefined : label"
    >{{ glyph }}</span
  >
</template>

<style scoped lang="scss">
.app_icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>
