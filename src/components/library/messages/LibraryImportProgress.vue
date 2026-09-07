<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppPlaceholder from '@/components/common/placeholder/AppPlaceholder.vue';
import AppSpinner from '@/components/common/placeholder/AppSpinner.vue';
import { useLibraryStore } from '@/stores/library';

const { t } = useI18n();
const library = useLibraryStore();
const phase = computed(() => {
  if (library.isImportRefreshing) {
    return 'refreshing';
  }
  if (library.importProgress?.finalizing) {
    return 'saving';
  }
  return library.importPercent === null ? 'scanning' : 'reading';
});
</script>

<template>
  <AppPlaceholder
    data-testid="library-import-progress"
    :title="
      library.importPercent === null
        ? t('library.toolbar.adding')
        : t('library.toolbar.addingPercent', { percent: library.importPercent })
    "
    :message="t(`library.importProgress.${phase}`)"
    aria-busy="true"
  >
    <AppSpinner :label="t(`library.importProgress.${phase}`)" />
    <progress
      class="library_import_progress"
      :value="library.importPercent ?? undefined"
      max="100"
      :aria-label="t('library.toolbar.adding')"
    ></progress>
  </AppPlaceholder>
</template>

<style scoped lang="scss">
.library_import_progress {
  width: min(20rem, 100%);
  height: $space_sm;
  accent-color: var(--color_accent);
}
</style>
