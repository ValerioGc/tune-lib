<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import { MAX_LISTED_ARTISTS } from '@/config/app-config';
import CoverImage from '@/components/library/CoverImage.vue';
import PlayingBubble from '@/components/library/PlayingBubble.vue';
import {
  DEFAULT_FACET_SORT,
  facetSortColumns,
  type FacetField,
  type FacetSort,
  type FacetSortColumn,
} from '@/services/facet-columns';
import {
  FACET_PAGES,
  genreCardHeight,
  genreCardWidth,
  groupCardWidth,
} from '@/services/preview-size';
import { formatDuration } from '@/services/track-sorting';
import { useSettingsStore } from '@/stores/settings';
import type { TrackView } from '@/types/library';
import type { ViewMode } from '@/types/settings';

export interface FacetGroupOpenPayload {
  field: FacetField;
  key: string;
  name: string;
}

interface FacetGroup extends FacetGroupOpenPayload {
  trackCount: number;
  albumCount: number;
  artistCount: number;
  durationMs: number;
  artists: string[];
  coverTrack: TrackView | null;
  coverTracks: TrackView[];
  isUnknown: boolean;
  playing: boolean;
}

const props = withDefaults(
  defineProps<{
    tracks: readonly TrackView[];
    field: FacetField;
    viewMode: ViewMode;
    playingTrack?: TrackView | null;
  }>(),
  {
    playingTrack: null,
  },
);

const emit = defineEmits<{
  open: [group: FacetGroupOpenPayload];
}>();

/**
 * How the groups are ordered.
 *
 * A model rather than state of its own: the control that changes it sits in the toolbar at
 * the top of the page, too far up the tree to reach from here, so whoever placed this list
 * holds the value and binds it. Left unbound — as the group window does — it keeps its own.
 */
const sort = defineModel<FacetSort>('sort', {
  default: () => ({ ...DEFAULT_FACET_SORT }),
});

const { t } = useI18n();
const settings = useSettingsStore();

// The cards of a group carry more than a title, so they start wider than a track's — but
// they follow the same choice.
// Artists, albums and genres are three pages, each with a size of its own.
const previewSize = computed(() => settings.previewSizes[FACET_PAGES[props.field]]);

const cardWidth = computed(() =>
  props.field === 'genre' ? genreCardWidth(previewSize.value) : groupCardWidth(previewSize.value),
);

/** Only the genre cards have one: the others are as tall as a square and its writing. */
const cardHeight = computed(() =>
  props.field === 'genre' ? genreCardHeight(previewSize.value) : undefined,
);

function facetValueOf(track: TrackView, field: FacetField): string {
  return track[field]?.trim() ?? '';
}

function groupLabelOf(field: FacetField, value: string): string {
  return value.length > 0 ? value : t(`library.groups.unknown.${field}`);
}

function uniqueValues(tracks: readonly TrackView[], field: FacetField): string[] {
  return [
    ...new Set(
      tracks.map((track) => groupLabelOf(field, facetValueOf(track, field))).filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function uniquePresentValues(tracks: readonly TrackView[], field: FacetField): string[] {
  return [
    ...new Set(
      tracks.map((track) => facetValueOf(track, field)).filter((value) => value.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function representativeCoverTracks(tracks: readonly TrackView[]): TrackView[] {
  const byAlbum = new Map<string, TrackView>();

  for (const track of tracks) {
    const albumKey = track.album?.trim() || track.id;
    const current = byAlbum.get(albumKey);

    if (
      current === undefined ||
      (track.hasCover && !track.missing && (!current.hasCover || current.missing))
    ) {
      byAlbum.set(albumKey, track);
    }
  }

  return [...byAlbum.values()]
    .sort((left, right) => {
      const rightHasCover = right.hasCover && !right.missing;
      const leftHasCover = left.hasCover && !left.missing;

      if (leftHasCover !== rightHasCover) {
        return rightHasCover ? 1 : -1;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, 4);
}

const groups = computed<FacetGroup[]>(() => {
  const grouped = new Map<string, TrackView[]>();

  for (const track of props.tracks) {
    const value = facetValueOf(track, props.field);
    const key = value.length > 0 ? value : '__unknown__';
    grouped.set(key, [...(grouped.get(key) ?? []), track]);
  }

  return [...grouped.entries()]
    .map(([key, tracks]) => {
      const isUnknown = key === '__unknown__';
      const playingTrackId = props.playingTrack?.id ?? null;

      return {
        field: props.field,
        key,
        name: isUnknown ? t(`library.groups.unknown.${props.field}`) : key,
        trackCount: tracks.length,
        albumCount:
          props.field === 'artist' || props.field === 'genre'
            ? uniquePresentValues(tracks, 'album').length
            : 0,
        // Only a genre gathers several artists: for the other two the count says nothing.
        artistCount: props.field === 'genre' ? uniquePresentValues(tracks, 'artist').length : 0,
        durationMs: tracks.reduce((total, track) => total + track.durationMs, 0),
        artists: props.field === 'album' ? uniqueValues(tracks, 'artist') : [],
        coverTrack:
          props.field === 'album'
            ? (tracks.find((track) => track.hasCover && !track.missing) ?? tracks[0] ?? null)
            : null,
        coverTracks: props.field === 'album' ? [] : representativeCoverTracks(tracks),
        isUnknown,
        playing: playingTrackId !== null && tracks.some((track) => track.id === playingTrackId),
      };
    })
    .sort((left, right) => {
      if (left.isUnknown !== right.isUnknown) {
        return left.isUnknown ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    });
});

/** The columns of the list view, in the order the rows lay them out. */
const listColumns = computed(() =>
  facetSortColumns(props.field).map((column) => ({ key: column.key, label: t(column.labelKey) })),
);

function sortValueOf(group: FacetGroup, column: FacetSortColumn): string | number {
  if (column === 'name') {
    return group.name;
  }

  if (column === 'artist') {
    // Sorted on the names themselves: a compilation is not filed under "various".
    return group.artists.join(', ');
  }

  if (column === 'artists') {
    return group.artistCount;
  }

  if (column === 'albums') {
    return group.albumCount;
  }

  if (column === 'tracks') {
    return group.trackCount;
  }

  return group.durationMs;
}

const sortedGroups = computed(() => {
  const { column, direction } = sort.value;
  const sign = direction === 'asc' ? 1 : -1;

  return [...groups.value].sort((left, right) => {
    // The group without a value for the field stays at the bottom in both directions.
    if (left.isUnknown !== right.isUnknown) {
      return left.isUnknown ? 1 : -1;
    }

    const leftValue = sortValueOf(left, column);
    const rightValue = sortValueOf(right, column);
    const outcome =
      typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), undefined, {
            sensitivity: 'base',
            numeric: true,
          });

    return outcome === 0 ? left.name.localeCompare(right.name) : outcome * sign;
  });
});

function ariaSort(column: FacetSortColumn) {
  if (sort.value.column !== column) {
    return 'none';
  }

  return sort.value.direction === 'asc' ? 'ascending' : 'descending';
}

function toggleSort(column: FacetSortColumn) {
  sort.value =
    sort.value.column === column
      ? { column, direction: sort.value.direction === 'asc' ? 'desc' : 'asc' }
      : { column, direction: 'asc' };
}

/** The artists of an album, or the fact that there are too many to name. */
function artistsLabel(artists: readonly string[]): string {
  return artists.length > MAX_LISTED_ARTISTS
    ? t('library.groups.variousArtists')
    : artists.join(', ');
}

function openGroup(group: FacetGroup) {
  emit('open', { field: group.field, key: group.key, name: group.name });
}

/** The rows of the list view are not buttons: they need the keys wired by hand. */
function openGroupFromKeyboard(event: KeyboardEvent, group: FacetGroup) {
  event.preventDefault();
  openGroup(group);
}
</script>

<template>
  <section
    v-if="viewMode === 'preview'"
    class="library_facet_preview common_scroll_area"
    :class="{ library_facet_preview_genre: field === 'genre' }"
    :style="{ '--preview_card_width': cardWidth, '--preview_card_height': cardHeight }"
    :aria-label="t(`library.groups.columns.${field}`)"
  >
    <!-- A real button rather than a card pretending to be one: Enter, Space and focus
         come with the element instead of being wired by hand. -->
    <button
      v-for="group in sortedGroups"
      :key="group.key"
      class="library_facet_card common_glass"
      :class="{
        library_facet_card_artist: field === 'artist',
        library_facet_card_album: field === 'album',
        library_facet_card_genre: field === 'genre',
        library_facet_card_playing: group.playing,
      }"
      type="button"
      :aria-label="t('library.groups.openLabel', { name: group.name })"
      :aria-current="group.playing ? 'true' : undefined"
      :title="group.name"
      @click="openGroup(group)"
    >
      <PlayingBubble v-if="group.playing" />

      <CoverImage
        v-if="field === 'album' && group.coverTrack !== null"
        class="library_facet_card_cover"
        :track="group.coverTrack"
        size="card"
      />
      <div
        v-else-if="group.coverTracks.length > 0"
        class="library_facet_card_cover library_facet_card_cover_mosaic"
        :class="{ library_facet_card_cover_mosaic_single: group.coverTracks.length === 1 }"
        aria-hidden="true"
      >
        <CoverImage
          v-for="track in group.coverTracks"
          :key="track.id"
          class="library_facet_card_cover_tile"
          :track="track"
          size="card"
          eager
        />
      </div>
      <div class="library_facet_card_body">
        <h3 class="library_facet_card_title">{{ group.name }}</h3>
        <p v-if="field === 'album'" class="library_facet_card_meta">
          {{ t('library.groups.albumArtist', { artists: artistsLabel(group.artists) }) }}
        </p>
        <p v-if="field === 'genre'" class="library_facet_card_meta">
          {{ t('library.groups.artistCount', { count: group.artistCount }, group.artistCount) }}
        </p>
        <p v-if="field === 'artist' || field === 'genre'" class="library_facet_card_meta">
          {{ t('library.groups.albumCount', { count: group.albumCount }, group.albumCount) }}
        </p>
        <p class="library_facet_card_meta">
          {{ t('library.groups.trackCount', { count: group.trackCount }, group.trackCount) }}
          <span aria-hidden="true"> · </span>
          {{ formatDuration(group.durationMs) }}
        </p>
      </div>
    </button>
  </section>

  <table
    v-else
    class="library_facet_list common_scroll_area"
    :class="{
      library_facet_list_album: field === 'album',
      library_facet_list_artist: field === 'artist',
      library_facet_list_genre: field === 'genre',
    }"
    :aria-rowcount="groups.length"
  >
    <thead class="library_facet_list_head">
      <tr class="library_facet_list_row library_facet_list_head_row">
        <th
          v-for="column in listColumns"
          :key="column.key"
          class="library_facet_list_heading"
          scope="col"
          :aria-sort="ariaSort(column.key)"
        >
          <button
            class="library_facet_list_sort"
            :class="{ library_facet_list_sort_active: sort.column === column.key }"
            type="button"
            :aria-label="t('library.sort.sortBy', { column: column.label })"
            :title="t('library.sort.sortBy', { column: column.label })"
            :data-testid="`facet-sort-${column.key}`"
            @click="toggleSort(column.key)"
          >
            <span class="library_facet_list_sort_label">{{ column.label }}</span>
            <AppIcon
              v-if="sort.column === column.key"
              :name="sort.direction === 'asc' ? 'sortAsc' : 'sortDesc'"
            />
          </button>
        </th>
      </tr>
    </thead>

    <tbody class="library_facet_list_body">
      <tr
        v-for="group in sortedGroups"
        :key="group.key"
        class="library_facet_list_row"
        :class="{ library_facet_list_row_playing: group.playing }"
        tabindex="0"
        :aria-label="t('library.groups.openLabel', { name: group.name })"
        :aria-current="group.playing ? 'true' : undefined"
        @click="openGroup(group)"
        @keydown.enter="openGroupFromKeyboard($event, group)"
        @keydown.space="openGroupFromKeyboard($event, group)"
      >
        <td class="library_facet_list_cell library_facet_list_name">
          <span class="library_facet_list_name_text" :title="group.name">{{ group.name }}</span>
          <span
            v-if="group.playing"
            class="library_facet_list_badge"
            :title="t('library.row.playing')"
          >
            <AppIcon name="play" :label="t('library.row.playing')" />
            <span class="library_facet_list_badge_label">{{ t('library.row.playing') }}</span>
          </span>
        </td>
        <td v-if="field === 'album'" class="library_facet_list_cell">
          {{ artistsLabel(group.artists) }}
        </td>
        <td v-if="field === 'genre'" class="library_facet_list_cell">
          {{ t('library.groups.artistCount', { count: group.artistCount }, group.artistCount) }}
        </td>
        <td v-if="field === 'artist' || field === 'genre'" class="library_facet_list_cell">
          {{ t('library.groups.albumCount', { count: group.albumCount }, group.albumCount) }}
        </td>
        <td class="library_facet_list_cell">
          {{ t('library.groups.trackCount', { count: group.trackCount }, group.trackCount) }}
        </td>
        <td class="library_facet_list_cell library_facet_list_duration">
          {{ formatDuration(group.durationMs) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped lang="scss">
.library_facet_preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--preview_card_width, 13rem), 1fr));
  align-content: start;
  align-items: stretch;
  gap: $space_md;
  flex: 1;
  min-height: 0;
  padding-bottom: $space_md;

  // A genre card is read sideways, so its rows are a height rather than a square.
  &_genre {
    grid-auto-rows: var(--preview_card_height, 9rem);
  }
}

// One shape for all of them: a square cover as wide as the card, the writing under it, and
// the same padding on every side. No floor and no height of its own — a number written here
// is a guess at one card width, and there are three of those and three kinds of card.
.library_facet_card {
  display: flex;
  position: relative;
  align-self: stretch;
  flex-direction: column;
  gap: $space_md;
  padding: $space_md;
  color: var(--color_text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color $duration_fast ease,
    border-color $duration_fast ease;

  &:hover {
    background-color: var(--row_hover_background);
  }

  @include focus_ring;

  &_playing {
    border-color: var(--color_accent);
    background-color: var(--row_selected_background);
    box-shadow: inset 0 0 0 1px var(--color_accent);
  }

  &_cover {
    flex-shrink: 0;

    &_mosaic {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
      aspect-ratio: 1;
      overflow: hidden;
      border: 1px solid var(--color_border);
      border-radius: $radius_md;
      background-color: var(--color_surface_alt);

      :deep(.cover_image) {
        width: 100%;
        height: 100%;
        border: 0;
        border-radius: 0;
      }

      // The mosaic sizes its own tiles: a square each would fight the grid.
      :deep(.cover_image_card) {
        aspect-ratio: auto;
      }

      &_single {
        grid-template-columns: 1fr;
      }
    }
  }

  &_genre {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-column: auto;
    flex-direction: initial;
    gap: $space_md;
    align-items: center;
    min-height: 0;
    padding: $space_2xs;

    // A square as tall as the row, so widening the cards enlarges these covers too rather
    // than leaving them adrift in a taller card.
    .library_facet_card_cover {
      width: auto;
      height: 100%;
      aspect-ratio: 1;
    }

    .library_facet_card_body {
      gap: $space_2xs;
      justify-content: center;
      height: 100%;
      padding-inline: 0;
    }

    // Room kept whether or not the group is playing, so the title never shifts.
    .library_facet_card_title {
      padding-right: 2rem;
    }
  }

  &_body {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    gap: $space_xs;
    min-width: 0;
    padding-inline: $space_2xs;
  }

  &_title {
    overflow: hidden;
    font-size: 1.1em;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_meta {
    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.875em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 560px) {
  .library_facet_preview_genre {
    grid-template-columns: 1fr;
    grid-auto-rows: 8.75rem;
  }

  .library_facet_card_genre {
    grid-template-columns: 5.5rem minmax(0, 1fr);

    .library_facet_card_cover {
      width: 5.5rem;
      height: 5.5rem;
    }
  }
}

// One scrolling box holding the head and the rows, as in the track table: the head is
// sticky inside it, so it stays without the two ever drifting apart.
.library_facet_list {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
  border: 1px solid var(--color_border);
  border-radius: $radius_md;

  &_row {
    display: grid;
    grid-template-columns: minmax(10rem, 1.4fr) minmax(7rem, 0.55fr) minmax(6rem, 0.45fr);
    gap: $space_md;
    align-items: center;
    min-height: 3rem;
    padding: 0 $space_md;
    border-bottom: 1px solid var(--color_border);
    cursor: pointer;
    transition: background-color $duration_fast ease;

    &:last-child {
      border-bottom: 0;
    }

    &:hover {
      background-color: var(--row_hover_background);
    }

    @include focus_ring;

    &_playing {
      border-color: var(--color_accent);
      background-color: var(--row_selected_background);
      box-shadow: inset 2px 0 0 var(--color_accent);
    }
  }

  // The name is the column being read, so it takes what the others do not need. Beside it
  // sit counts — "12 brani", "3 album" — the same handful of characters whatever the window
  // is doing, and they were being handed a share of the free space they had nothing to put
  // in while the name next to them was cut short.
  &_artist &_row {
    grid-template-columns:
      minmax(12rem, 2.6fr) minmax(6rem, 0.4fr) minmax(6rem, 0.4fr)
      minmax(6rem, 0.35fr);
  }

  // The album list has a real name in its second column rather than a count, so that one
  // keeps room to be read as well.
  &_album &_row {
    grid-template-columns:
      minmax(12rem, 2fr) minmax(9rem, 1fr) minmax(6rem, 0.4fr)
      minmax(6rem, 0.35fr);
  }

  &_genre &_row {
    grid-template-columns:
      minmax(9rem, 1.1fr) minmax(6rem, 0.5fr) minmax(6rem, 0.5fr) minmax(6rem, 0.45fr)
      minmax(5rem, 0.35fr);
  }

  &_head {
    display: block;
    flex: 0 0 auto;
    position: sticky;
    top: 0;
    z-index: 2;
    border-bottom: 1px solid var(--color_border);
    background-color: var(--table_head_background);
  }

  &_heading {
    min-width: 0;
    padding: 0;
    color: var(--color_text_muted);
    font-size: 0.75em;
    font-weight: 600;
    text-align: left;
    text-transform: uppercase;
  }

  // The head row is read, not opened: it keeps the grid of the rows without their hover.
  &_head_row {
    cursor: default;

    &:hover {
      background-color: transparent;
    }
  }

  &_sort {
    display: inline-flex;
    gap: $space_xs;
    align-items: center;
    min-width: 0;
    max-width: 100%;
    padding: $space_xs 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-transform: inherit;
    cursor: pointer;

    &:hover {
      color: var(--color_text);
    }

    &_active {
      color: var(--color_accent);
    }

    &_label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @include focus_ring;
  }

  // Never compressed to fit the box: the rows are what the box scrolls through.
  &_body {
    display: block;
    flex: 0 0 auto;
  }

  &_cell {
    min-width: 0;
    padding: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_name {
    display: flex;
    gap: $space_sm;
    align-items: center;
    font-weight: 600;
  }

  &_name_text {
    @include selectable_text;

    overflow: hidden;
    text-overflow: ellipsis;
  }

  &_duration {
    @include selectable_text;

    font-variant-numeric: tabular-nums;
  }

  // Sits next to the name, in its cell: as a grid item of its own it would have added a
  // column the header does not have.
  &_badge {
    display: inline-flex;
    gap: $space_2xs;
    align-items: center;
    flex-shrink: 0;
    padding: 0 $space_sm;
    border: 1px solid var(--color_accent);
    border-radius: $radius_sm;
    color: var(--color_accent);
    font-size: 0.75em;
    font-weight: 700;
  }

  @media (max-width: 760px) {
    // The columns tighten here, so the badge keeps its symbol and drops its label.
    &_badge {
      justify-content: center;
      width: 1.5rem;
      padding: 0;
      border-radius: 999px;
    }

    &_badge_label {
      display: none;
    }

    &_head,
    &_row {
      grid-template-columns: minmax(8rem, 1fr) minmax(5rem, auto) minmax(5rem, auto);
    }

    &_album &_row,
    &_artist &_row,
    &_genre &_row {
      grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(5rem, auto);
    }

    &_album &_duration,
    &_album &_heading:last-child,
    &_artist &_duration,
    &_artist &_heading:last-child,
    &_genre &_duration,
    &_genre &_heading:last-child {
      display: none;
    }
  }
}
</style>
