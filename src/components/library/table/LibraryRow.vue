<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import LibraryCoverCell from '@/components/library/table/LibraryCoverCell.vue';
import LibraryRowActions from '@/components/library/table/LibraryRowActions.vue';
import { PLAYING_LABEL_MIN_TITLE_WIDTH_PX } from '@/config/layout';
import { tableColumnValue } from '@/services/table-columns';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { TrackSelectionIntent, TrackView } from '@/types/library';
import { TABLE_COLUMN_WIDTHS, type TableColumnSetting } from '@/types/settings';

const props = defineProps<{
  track: TrackView;
  columns?: readonly TableColumnSetting[];
  selected: boolean;
  playing: boolean;
}>();

const emit = defineEmits<{
  select: [intent: TrackSelectionIntent];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
}>();

const { t } = useI18n();
const player = usePlayerStore();
const settings = useSettingsStore();
const actions = ref<InstanceType<typeof LibraryRowActions> | null>(null);

const accentStyle = computed(() =>
  props.playing && settings.coverGradientEnabled && player.coverAccent !== null
    ? { '--cover_row_gradient': player.coverAccent.rowGradient }
    : {},
);

const columns = computed(
  () => props.columns ?? settings.tableColumns.filter((column) => column.visible),
);

const showsPlayingLabel = computed(() => {
  const title = columns.value.find((column) => column.key === 'title');

  return (title?.width ?? TABLE_COLUMN_WIDTHS.title.default) >= PLAYING_LABEL_MIN_TITLE_WIDTH_PX;
});

function valueFor(column: TableColumnSetting): string {
  return tableColumnValue(props.track, column.key, t('library.row.unknown'));
}

function select(event: MouseEvent | KeyboardEvent) {
  emit('select', {
    id: props.track.id,
    additive: event instanceof MouseEvent && (event.ctrlKey || event.metaKey),
    range: event.shiftKey,
  });
}

function openActionsMenu(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  actions.value?.open();
}
</script>

<template>
  <tr
    class="library_row"
    :class="{
      library_row_selected: selected,
      library_row_missing: track.missing,
      library_row_playing: playing,
    }"
    :style="accentStyle"
    tabindex="0"
    :aria-selected="selected"
    :aria-current="playing ? 'true' : undefined"
    @click="select($event)"
    @contextmenu="openActionsMenu"
    @dblclick="emit('play', track)"
    @keydown.enter="select($event)"
  >
    <td
      v-for="column in columns"
      :key="column.key"
      class="library_row_cell"
      :class="{ library_row_cover: column.key === 'cover' }"
    >
      <LibraryCoverCell v-if="column.key === 'cover'" :track="track" />
      <template v-else-if="column.key === 'title'">
        <span class="library_row_title">
          <!-- Columns are narrow and resizable: the full value is one hover away. -->
          <span class="library_row_text" :title="track.title">{{ track.title }}</span>
          <span
            v-if="playing"
            class="library_row_badge library_row_badge_playing"
            :class="{ library_row_badge_compact: !showsPlayingLabel }"
            :title="t('library.row.playing')"
          >
            <AppIcon name="play" :label="showsPlayingLabel ? '' : t('library.row.playing')" />
            <template v-if="showsPlayingLabel">{{ t('library.row.playing') }}</template>
          </span>
          <span v-if="track.missing" class="library_row_badge">
            <AppIcon name="warning" />
            {{ t('library.row.missing') }}
          </span>
        </span>
      </template>
      <span v-else-if="column.key === 'duration'" class="library_row_duration">
        {{ valueFor(column) }}
      </span>
      <span v-else class="library_row_text" :title="valueFor(column)">
        {{ valueFor(column) }}
      </span>
    </td>
    <td class="library_row_cell library_row_actions">
      <LibraryRowActions
        ref="actions"
        :track="track"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />
    </td>
  </tr>
</template>

<style scoped lang="scss">
.library_row {
  display: grid;
  grid-template-columns: var(--library_grid_columns);
  gap: $space_sm;
  align-items: center;
  height: var(--library_row_height);
  // Nothing on the left: the cover is the first thing in the row and it starts at the edge
  // of the list, filling its column rather than sitting in from it. The cells keep a step
  // of their own, which is what holds the writing apart.
  padding: 0 $space_md 0 0;
  border-bottom: 1px solid var(--color_border);
  cursor: pointer;
  transition: background-color $duration_fast ease;

  &:hover {
    background-color: var(--row_hover_background);
  }

  @include focus_ring;

  &_selected {
    background-color: var(--row_selected_background);
  }

  &_missing {
    color: var(--color_text_muted);
  }

  &_playing {
    box-shadow: inset 3px 0 0 var(--color_accent);
    background-color: var(--row_selected_background);
  }

  &_playing[style*='--cover_row_gradient'] {
    background: var(--cover_row_gradient), var(--color_surface);
  }

  // The step in from the edge of the column, the same one the headings take: without it
  // the text of a cell starts where the text of the one before it ends.
  &_cell {
    padding: 0 0 0 $space_sm;
    border-right: var(--library_column_divider, none);
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    white-space: nowrap;
  }

  // The cover is the one cell measured in both directions: it fills its column and the
  // row was made tall enough to hold it.
  //
  // No step in from the edge either: the step is there so writing does not begin where the
  // writing before it ended, and a picture that fills its column has nothing to keep clear.
  &_cover {
    display: flex;
    padding-left: 0;
    // The whole cell, corner to corner: the picture is cropped to fill it rather than left
    // with a band of empty row above and below.
    height: 100%;
  }

  &_title {
    display: flex;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
  }

  &_text {
    @include selectable_text;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &_badge {
    display: inline-flex;
    gap: $space_2xs;
    align-items: center;
    flex-shrink: 0;
    padding: 0 $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_sm;
    font-size: 0.75em;

    &_playing {
      border-color: var(--color_accent);
      color: var(--color_accent);
    }

    // Only the symbol is left: a round chip rather than a squashed label.
    &_compact {
      justify-content: center;
      width: 1.5rem;
      padding: 0;
      border-radius: 999px;
    }
  }

  &_duration {
    @include selectable_text;

    font-variant-numeric: tabular-nums;
  }

  // The cell paints nothing: the menu sits straight on the row. A background of its own
  // could never match, because the gradient of a playing row is spread over the whole
  // width and would restart inside these few rem as a brighter patch.
  // The menu is pinned to the right edge and takes no step in: the step is for reading.
  &_actions {
    display: flex;
    gap: $space_xs;
    // The track the grid template holds for the actions, the same one the heading takes.
    grid-column: -2 / -1;
    padding-left: 0;
    border-right: 0;
    position: sticky;
    right: 0;
    z-index: 1;
    width: 2.5rem;
    justify-self: end;
    justify-content: center;
    background: none;
    overflow: visible;
  }
}
</style>
