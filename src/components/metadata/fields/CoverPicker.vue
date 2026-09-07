<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import { ALLOWED_COVER_MIME, validateCoverFile } from '@/services/metadata-validation';
import type { Cover } from '@/types/library';

const props = defineProps<{ current: string | null }>();

const emit = defineEmits<{
  select: [cover: Cover];
  remove: [];
}>();

const { t } = useI18n();
const input = ref<HTMLInputElement | null>(null);
const preview = ref<string | null>(props.current);
const errorKey = ref<string | null>(null);

watch(
  () => props.current,
  (value) => {
    preview.value = value;
  },
);

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file === undefined) {
    return;
  }

  const problem = validateCoverFile(file);
  if (problem !== null) {
    errorKey.value = problem;
    return;
  }

  errorKey.value = null;
  const data = await readAsBase64(file);
  preview.value = `data:${file.type};base64,${data}`;
  emit('select', { mimeType: file.type, data });
}

function onRemove() {
  errorKey.value = null;
  preview.value = null;
  emit('remove');
}
</script>

<template>
  <div class="cover_picker">
    <span class="cover_picker_label">{{ t('metadata.cover.label') }}</span>
    <div class="cover_picker_body">
      <div class="cover_picker_preview">
        <img v-if="preview !== null" :src="preview" :alt="t('metadata.cover.label')" />
        <AppIcon v-else name="note" :label="t('library.row.noCover')" />
      </div>
      <div class="cover_picker_actions">
        <AppButton @click="input?.click()">{{ t('metadata.cover.choose') }}</AppButton>
        <AppButton variant="ghost" :disabled="preview === null" @click="onRemove">
          {{ t('metadata.cover.remove') }}
        </AppButton>
        <input
          ref="input"
          class="cover_picker_input common_visually_hidden"
          type="file"
          :accept="ALLOWED_COVER_MIME.join(',')"
          data-testid="cover-input"
          @change="onFile"
        />
      </div>
    </div>
    <p v-if="errorKey !== null" class="cover_picker_error" role="alert">
      {{ t(`metadata.errors.${errorKey}`) }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.cover_picker {
  display: flex;
  flex-direction: column;
  gap: $space_xs;

  &_label {
    font-size: 0.875em;
    color: var(--color_text_muted);
  }

  &_body {
    display: flex;
    gap: $space_md;
    align-items: center;
  }

  &_preview {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 5rem;
    height: 5rem;
    overflow: hidden;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_surface_alt);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &_actions {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
    align-items: flex-start;
  }

  &_error {
    color: #c42b1c;
    font-size: 0.8125em;
  }
}
</style>
