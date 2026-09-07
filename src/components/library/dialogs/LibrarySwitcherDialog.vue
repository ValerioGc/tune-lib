<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import { useLibraryStore } from '@/stores/library';
import { useSettingsStore } from '@/stores/settings';
import type { LibrarySummary } from '@/types/library';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();

async function openLibrary(entry: LibrarySummary) {
  if (!entry.active) {
    await library.switchLibrary(entry.id);
  }

  emit('close');
}
</script>

<template>
  <AppModal :open="open" :title="t('library.catalog.switcher.title')" @close="emit('close')">
    <ul class="library_switcher">
      <li
        v-for="entry in library.libraries"
        :key="entry.id"
        class="library_switcher_item"
        :class="{ library_switcher_item_active: entry.active }"
      >
        <div class="library_switcher_info">
          <span class="library_switcher_name">{{ entry.name }}</span>
          <span class="library_switcher_meta">
            {{ t('library.catalog.trackCount', entry.trackCount) }}
            <template v-if="entry.active"> · {{ t('library.catalog.active') }}</template>
            <template v-if="entry.id === settings.mainLibraryId">
              · {{ t('library.catalog.primary') }}
            </template>
          </span>
        </div>

        <AppButton
          :disabled="entry.active"
          :aria-label="t('library.catalog.open', { name: entry.name })"
          data-testid="switch-library"
          @click="openLibrary(entry)"
        >
          <AppIcon v-if="entry.active" name="check" />
          {{ entry.active ? t('library.catalog.active') : t('library.catalog.openShort') }}
        </AppButton>
      </li>
    </ul>

    <template #actions>
      <AppButton @click="emit('close')">{{ t('library.catalog.switcher.close') }}</AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.library_switcher {
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  margin: 0;
  padding: 0;
  list-style: none;

  &_item {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm 0;
    border-bottom: 1px solid var(--color_border);

    &:last-child {
      border-bottom: 0;
    }

    &_active {
      color: var(--color_text);
    }
  }

  &_info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &_name {
    overflow: hidden;
    color: var(--color_text);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_meta {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }
}
</style>
