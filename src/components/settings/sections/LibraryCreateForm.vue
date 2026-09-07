<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppInput from '@/components/common/input/AppInput.vue';
import { MAX_LIBRARY_NAME_LENGTH } from '@/config/app-config';
import { useLibraryStore } from '@/stores/library';

const { t } = useI18n();
const library = useLibraryStore();

const name = ref('');

// Whitespace is not a name: the shell refuses it, and the button says so before it is
// pressed rather than after.
const canCreate = computed(() => name.value.trim().length > 0);

onMounted(async () => {
  await library.loadLibraries();
});

/**
 * Why the last attempt was turned down, if it was.
 *
 * Kept here rather than read from the store: the same key is set by renaming a library,
 * and an answer to one question has no business appearing under the other.
 */
const error = ref('');

watch(name, () => {
  error.value = '';
});

async function create() {
  error.value = '';

  if (await library.createLibrary(name.value)) {
    name.value = '';
    return;
  }

  const key = library.errorKey;
  error.value = key === null ? '' : t(`library.errors.${key}`);
}
</script>

<template>
  <form class="library_create_form" @submit.prevent="create">
    <AppInput
      v-model="name"
      :label="t('library.catalog.create.label')"
      :placeholder="t('library.catalog.create.placeholder')"
      :max-length="MAX_LIBRARY_NAME_LENGTH"
    />
    <AppButton type="submit" variant="primary" :disabled="!canCreate" data-testid="create-library">
      {{ t('library.catalog.create.submit') }}
    </AppButton>

    <p v-if="error !== ''" class="library_create_form_error" role="alert">{{ error }}</p>
  </form>
</template>

<style scoped lang="scss">
// Creating a library and working on the ones already there are two different jobs in one
// section: the line is what says where one ends.
.library_create_form {
  display: flex;
  flex-wrap: wrap;
  gap: $space_md;
  align-items: flex-end;
  padding-bottom: $space_lg;
  border-bottom: 1px solid var(--color_border);

  // Its own line under the field and the button, whatever the row has wrapped into.
  &_error {
    flex-basis: 100%;
    color: #c42b1c;
    font-size: 0.875em;
  }
}
</style>
