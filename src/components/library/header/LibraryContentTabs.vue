<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import LibraryTabs from '@/components/library/header/LibraryTabs.vue';
import { LIBRARY_CONTENT_TABS, type LibraryContentTab } from '@/types/library';

defineProps<{
  modelValue: LibraryContentTab;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: LibraryContentTab];
}>();

const { t } = useI18n();

const tabs = computed(() =>
  LIBRARY_CONTENT_TABS.map((tab) => ({ id: tab, label: t(`library.tabs.${tab}`) })),
);
</script>

<template>
  <LibraryTabs
    class="library_content_tabs"
    :model-value="modelValue"
    :tabs="tabs"
    :label="t('library.tabs.label')"
    id-base="library"
    @update:model-value="emit('update:modelValue', $event as LibraryContentTab)"
  />
</template>
