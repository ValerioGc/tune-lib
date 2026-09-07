<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppInput from '@/components/common/input/AppInput.vue';
import LibraryImportButton from '@/components/library/header/LibraryImportButton.vue';
import LibrarySortSelect from '@/components/library/header/LibrarySortSelect.vue';
import PreviewSizeToggle from '@/components/library/preview/PreviewSizeToggle.vue';
import LibraryViewToggle from '@/components/library/header/LibraryViewToggle.vue';
import { useLibraryStore } from '@/stores/library';
import { SORTABLE_COLUMNS, type SortableColumn } from '@/types/library';
import type { PreviewSizePage, ViewMode } from '@/types/settings';
import type { SelectOption } from '@/types/ui';

const props = withDefaults(
  defineProps<{
    viewMode?: ViewMode | undefined;
    selectedCount?: number | undefined;
    /** The preview has no column headers to sort from: it gets the control instead. */
    showSort?: boolean;
    /**
     * The page whose cards the size control speaks for, or nothing where there are none.
     *
     * Every page keeps a size of its own, so the control has to know which one it is
     * changing — and every list puts its controls here, in the same place.
     */
    previewSizePage?: PreviewSizePage | undefined;
    /** How the list below is ordered, when it is not the tracks that are listed. */
    sort?: { column: string; direction: 'asc' | 'desc' } | undefined;
    sortOptions?: readonly SelectOption[] | undefined;
  }>(),
  {
    viewMode: undefined,
    selectedCount: 0,
    previewSizePage: undefined,
    sort: undefined,
    sortOptions: undefined,
  },
);
const emit = defineEmits<{
  'update:viewMode': [mode: ViewMode];
  sort: [column: string];
  editSelected: [];
}>();

const { t } = useI18n();
const library = useLibraryStore();

const searchValue = computed({
  get: () => library.query,
  set: (value: string) => library.setQuery(value),
});

/**
 * What the sort control offers, and where it stands.
 *
 * The tracks are sorted through the library itself; a list of groups is sorted by whoever
 * placed it, and hands its state down. Either way the control is here, at the top of the
 * page, rather than beside the thing it orders.
 */
const shownSort = computed(() => props.sort ?? library.sort);

/**
 * Whether the controls that act on the list are turned off.
 *
 * An empty library has nothing to search, to order, or to look at another way: the only
 * thing to do on this page is add to it, so the import button is the only one left on.
 */
const hasNothingToShow = computed(() => library.isEmpty);

const shownSortOptions = computed(
  () =>
    props.sortOptions ??
    SORTABLE_COLUMNS.map((column) => ({
      value: column,
      label: t(`library.columns.${column}`),
    })),
);

function sortBy(column: string) {
  if (props.sort !== undefined) {
    emit('sort', column);
    return;
  }

  library.toggleSort(column as SortableColumn);
}
</script>

<template>
  <div class="library_toolbar">
    <LibraryImportButton />

    <AppInput
      v-model="searchValue"
      class="library_toolbar_search"
      type="search"
      hide-label
      :disabled="hasNothingToShow"
      :label="t('library.toolbar.search')"
      :placeholder="t('library.toolbar.searchPlaceholder')"
    />

    <AppButton
      v-if="(selectedCount ?? 0) > 1"
      data-testid="bulk-edit-open"
      @click="emit('editSelected')"
    >
      {{ t('library.toolbar.editSelected', { count: selectedCount }) }}
    </AppButton>

    <LibrarySortSelect
      v-if="showSort"
      class="library_toolbar_sort"
      :column="shownSort.column"
      :direction="shownSort.direction"
      :options="shownSortOptions"
      :disabled="hasNothingToShow"
      @select="sortBy"
    />

    <PreviewSizeToggle
      v-if="previewSizePage !== undefined"
      class="library_toolbar_preview_size"
      :page="previewSizePage"
      :disabled="hasNothingToShow"
    />

    <!-- The view switch sits at the far right of the toolbar. -->
    <LibraryViewToggle
      class="library_toolbar_view"
      :model-value="viewMode"
      :disabled="hasNothingToShow"
      @update:model-value="emit('update:viewMode', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
.library_toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: $space_md;
  align-items: center;

  &_search {
    flex: 1;
    min-width: 12rem;
    max-width: 22rem;
  }

  &_sort {
    margin-left: auto;
  }

  &_preview_size {
    margin-left: auto;
  }

  &_view {
    margin-left: auto;
  }

  // Whichever of them comes first is pushed to the right and the others follow it, so the
  // group stays together at the end of the row instead of spreading along it.
  &_sort ~ &_preview_size,
  &_sort ~ &_view,
  &_preview_size ~ &_view {
    margin-left: 0;
  }
}
</style>
