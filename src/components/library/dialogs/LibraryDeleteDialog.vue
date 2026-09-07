<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import type { LibrarySummary } from '@/types/library';

const props = defineProps<{ library: LibrarySummary | null }>();

const emit = defineEmits<{
  confirm: [id: string];
  cancel: [];
}>();

const { t } = useI18n();

function confirm() {
  if (props.library !== null) {
    emit('confirm', props.library.id);
  }
}
</script>

<template>
  <AppModal
    :open="props.library !== null"
    :title="t('library.catalog.delete.title')"
    @close="emit('cancel')"
  >
    {{
      t('library.catalog.delete.message', {
        name: props.library?.name ?? '',
        count: props.library?.trackCount ?? 0,
      })
    }}
    <template #actions>
      <AppButton @click="emit('cancel')">{{ t('library.catalog.delete.cancel') }}</AppButton>
      <AppButton variant="danger" data-testid="confirm-library-delete" @click="confirm">
        {{ t('library.catalog.delete.confirm') }}
      </AppButton>
    </template>
  </AppModal>
</template>
