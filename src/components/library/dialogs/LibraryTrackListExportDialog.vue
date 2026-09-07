<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import AppSelect from '@/components/common/input/AppSelect.vue';
import { useLibraryStore } from '@/stores/library';
import {
  TRACK_EXPORT_FIELDS,
  TRACK_EXPORT_FORMATS,
  type TrackExportField,
  type TrackExportFormat,
} from '@/types/library';
import type { SelectOption } from '@/types/ui';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const library = useLibraryStore();

/**
 * What a list starts out carrying.
 *
 * Everything except the path: a full path says `C:\Users\<name>\...`, which is the one
 * field that describes the person rather than the music. A list is exported to be sent
 * somewhere, so that field is asked for rather than assumed.
 */
const DEFAULT_FIELDS: readonly TrackExportField[] = TRACK_EXPORT_FIELDS.filter(
  (field) => field !== 'path',
);

const format = ref<TrackExportFormat>('csv');
const selectedFields = ref<TrackExportField[]>([...DEFAULT_FIELDS]);

const formatOptions = computed<SelectOption[]>(() =>
  TRACK_EXPORT_FORMATS.map((value) => ({
    value,
    label: t(`library.exportList.formats.${value}`),
  })),
);

const fieldOptions = computed(() =>
  TRACK_EXPORT_FIELDS.map((value) => ({
    value,
    label: t(`library.exportList.fields.${value}`),
  })),
);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      format.value = 'csv';
      selectedFields.value = [...DEFAULT_FIELDS];
    }
  },
);

function setFormat(value: string) {
  format.value = value as TrackExportFormat;
}

function toggleField(field: TrackExportField, checked: boolean) {
  selectedFields.value = checked
    ? [...selectedFields.value, field]
    : selectedFields.value.filter((value) => value !== field);
}

async function submit() {
  if (await library.exportTrackList(format.value, selectedFields.value)) {
    emit('close');
  }
}
</script>

<template>
  <AppModal :open="open" :title="t('library.exportList.title')" @close="emit('close')">
    <form class="track_list_export" @submit.prevent="submit">
      <p class="track_list_export_description">{{ t('library.exportList.description') }}</p>

      <AppSelect
        :model-value="format"
        :options="formatOptions"
        :label="t('library.exportList.format')"
        @update:model-value="setFormat"
      />

      <fieldset class="track_list_export_fields">
        <legend class="track_list_export_legend">{{ t('library.exportList.fieldsLabel') }}</legend>
        <label v-for="option in fieldOptions" :key="option.value" class="track_list_export_field">
          <input
            type="checkbox"
            :checked="selectedFields.includes(option.value)"
            @change="toggleField(option.value, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ option.label }}</span>
        </label>
      </fieldset>
    </form>

    <template #actions>
      <AppButton @click="emit('close')">{{ t('library.exportList.cancel') }}</AppButton>
      <AppButton
        variant="primary"
        :disabled="selectedFields.length === 0"
        data-testid="track-list-export-submit"
        @click="submit"
      >
        {{ t('library.exportList.submit') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.track_list_export {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_description {
    color: var(--color_text_muted);
  }

  &_fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $space_sm;
    padding: 0;
    border: 0;
  }

  &_legend {
    grid-column: 1 / -1;
    margin-bottom: $space_xs;
    color: var(--color_text_muted);
    font-size: 0.875em;
  }

  &_field {
    display: flex;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
    color: var(--color_text);
  }
}
</style>
