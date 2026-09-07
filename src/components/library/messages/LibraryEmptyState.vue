<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppPlaceholder from '@/components/common/placeholder/AppPlaceholder.vue';
import { useLibraryStore } from '@/stores/library';

const props = defineProps<{ variant: 'empty' | 'noMatches' | 'noMissingInfo' }>();

const { t } = useI18n();
const library = useLibraryStore();

const title = computed(() => t(`library.${props.variant}.title`));
const message = computed(() => {
  if (props.variant === 'empty') {
    return t('library.empty.message');
  }

  if (props.variant === 'noMissingInfo') {
    return t('library.noMissingInfo.message');
  }

  return t('library.noMatches.message', { query: library.query });
});
</script>

<template>
  <AppPlaceholder :title="title" :message="message">
    <template v-if="variant === 'empty'">
      <div class="library_empty_actions">
        <AppButton variant="primary" :disabled="library.isImporting" @click="library.pickAndAdd()">
          {{ t('library.toolbar.add') }}
        </AppButton>
        <AppButton :disabled="library.isImporting" @click="library.pickFoldersAndAdd()">
          {{ t('library.toolbar.addFolder') }}
        </AppButton>
      </div>
      <p class="library_empty_hint">{{ t('library.empty.dropHint') }}</p>
    </template>
  </AppPlaceholder>
</template>

<style scoped lang="scss">
.library_empty_actions {
  display: flex;
  flex-wrap: wrap;
  gap: $space_sm;
  justify-content: center;
}

.library_empty_hint {
  color: var(--color_text_muted);
  font-size: 0.875em;
}
</style>
