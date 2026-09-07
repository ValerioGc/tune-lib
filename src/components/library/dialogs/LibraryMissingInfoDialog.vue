<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import AppSelect from '@/components/common/input/AppSelect.vue';
import { useLibraryStore } from '@/stores/library';
import { MISSING_INFO_FILTERS, type MissingInfoFilter } from '@/types/library';
import type { SelectOption } from '@/types/ui';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const library = useLibraryStore();

const options = computed<SelectOption[]>(() =>
  MISSING_INFO_FILTERS.map((value) => ({
    value,
    label: t(`library.toolbar.missingInfo.options.${value}`),
  })),
);

const missingInfoFilter = computed({
  get: () => library.missingInfoFilter,
  set: (value: string) => library.setMissingInfoFilter(value as MissingInfoFilter),
});
</script>

<template>
  <AppModal :open="open" :title="t('library.missingInfo.title')" @close="emit('close')">
    <div class="library_missing_info">
      <p class="library_missing_info_description">
        {{ t('library.missingInfo.description') }}
      </p>

      <AppSelect
        v-model="missingInfoFilter"
        :label="t('library.missingInfo.label')"
        :options="options"
        data-testid="missing-info-select"
      />

      <p class="library_missing_info_result" data-testid="missing-info-result">
        {{
          t(
            'library.missingInfo.result',
            { count: library.tracksMatchingMissingInfo.length },
            library.tracksMatchingMissingInfo.length,
          )
        }}
      </p>
    </div>

    <template #actions>
      <AppButton
        :disabled="library.missingInfoFilter === 'all'"
        data-testid="missing-info-dialog-reset"
        @click="library.setMissingInfoFilter('all')"
      >
        {{ t('library.missingInfo.reset') }}
      </AppButton>
      <AppButton variant="primary" @click="emit('close')">
        {{ t('library.missingInfo.close') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.library_missing_info {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_description,
  &_result {
    color: var(--color_text_muted);
  }
}
</style>
