<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppInput from '@/components/common/input/AppInput.vue';
import { MAX_LIBRARY_NAME_LENGTH } from '@/config/app-config';
import { useLibraryStore } from '@/stores/library';

const { t } = useI18n();
const library = useLibraryStore();
const name = ref(library.libraryName);

const isUnchanged = computed(() => name.value.trim() === library.libraryName);
const canSubmit = computed(() => !library.isRenaming && !isUnchanged.value);
const errorMessage = computed(() => {
  if (library.errorKey === 'invalidLibraryName' || library.errorKey === 'duplicateLibraryName') {
    return t(`library.errors.${library.errorKey}`);
  }

  if (library.errorKey === 'shellUnavailable' || library.errorKey === 'generic') {
    return t(`library.errors.${library.errorKey}`);
  }

  return '';
});

watch(
  () => library.libraryName,
  (value) => {
    name.value = value;
  },
);

onMounted(async () => {
  if (library.libraryName === '') {
    await library.loadInfo();
  }
});

async function submit() {
  await library.renameLibrary(name.value);
}
</script>

<template>
  <form class="library_name_form" @submit.prevent="submit">
    <AppInput
      v-model="name"
      :label="t('settings.libraryName.label')"
      :placeholder="t('settings.libraryName.placeholder')"
      :max-length="MAX_LIBRARY_NAME_LENGTH"
    />

    <div class="library_name_form_footer">
      <p v-if="errorMessage !== ''" class="library_name_form_error" role="alert">
        {{ errorMessage }}
      </p>
      <AppButton type="submit" variant="primary" :disabled="!canSubmit">
        {{ library.isRenaming ? t('settings.libraryName.saving') : t('settings.libraryName.save') }}
      </AppButton>
    </div>
  </form>
</template>

<style scoped lang="scss">
.library_name_form {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_footer {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
  }

  &_error {
    color: #c42b1c;
  }
}
</style>
