<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { MAX_LISTED_ARTISTS } from '@/config/app-config';
import CoverImage from '@/components/library/CoverImage.vue';
import type { TrackView } from '@/types/library';

export interface AlbumSummaryLink {
  key: string;
  name: string;
}

const props = defineProps<{
  name: string;
  coverTrack: TrackView | null;
  year: number | null;
  artists: readonly AlbumSummaryLink[];
  genres: readonly AlbumSummaryLink[];
  trackCount: number;
}>();

const emit = defineEmits<{ openArtist: [key: string]; openGenre: [key: string] }>();

const { t } = useI18n();

// Past a handful of names the line says nothing: the album is a compilation, and that is
// what it reports. The genres are always named, however many they are.
const hasVariousArtists = computed(() => props.artists.length > MAX_LISTED_ARTISTS);
</script>

<template>
  <div class="library_album_summary">
    <CoverImage
      v-if="props.coverTrack !== null"
      class="library_album_summary_cover"
      :track="props.coverTrack"
      size="card"
      eager
    />

    <!-- The fields speak for themselves here: no label in front of each one. -->
    <div class="library_album_summary_facts">
      <h3 class="library_album_summary_name" :title="props.name">{{ props.name }}</h3>

      <p v-if="props.year !== null" class="library_album_summary_year">{{ props.year }}</p>

      <p
        v-if="hasVariousArtists"
        class="library_album_summary_artists library_album_summary_various"
        data-testid="album-various-artists"
      >
        {{ t('library.groups.variousArtists') }}
      </p>

      <p v-else-if="props.artists.length > 0" class="library_album_summary_artists">
        <button
          v-for="artist in props.artists"
          :key="artist.key"
          class="library_album_summary_link"
          type="button"
          @click="emit('openArtist', artist.key)"
        >
          {{ artist.name }}
        </button>
      </p>

      <p v-if="props.genres.length > 0" class="library_album_summary_genres">
        <button
          v-for="genre in props.genres"
          :key="genre.key"
          class="library_album_summary_link library_album_summary_link_muted"
          type="button"
          @click="emit('openGenre', genre.key)"
        >
          {{ genre.name }}
        </button>
      </p>

      <p class="library_album_summary_count">
        {{ t('library.groups.trackCount', { count: props.trackCount }, props.trackCount) }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.library_album_summary {
  display: flex;
  flex: 1;
  gap: $space_md;
  align-items: flex-start;
  min-width: 0;

  &_cover {
    width: 7rem;
    flex-shrink: 0;
    box-shadow: var(--shadow_card);
  }

  // The modal header reads in small type: the facts of the album sit a step above it.
  &_facts {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space_2xs;
    min-width: 0;
    font-size: 1.0714em;
  }

  &_name {
    @include selectable_text;

    overflow: hidden;
    color: var(--color_text);
    font-size: 1.25em;
    font-weight: 700;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_year {
    @include selectable_text;

    color: var(--color_text_muted);
    font-variant-numeric: tabular-nums;
  }

  &_artists,
  &_genres {
    display: flex;
    flex-wrap: wrap;
    gap: $space_2xs $space_sm;
    min-width: 0;
  }

  &_various {
    @include selectable_text;

    font-weight: 700;
  }

  &_link {
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color_accent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.15em;

    &:hover {
      color: var(--color_accent_hover);
    }

    @include focus_ring;

    // A genre is a lead, not a heading: it carries less weight than the artists.
    &_muted {
      font-weight: 400;
    }
  }

  &_count {
    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.875em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 560px) {
  .library_album_summary_cover {
    width: 5rem;
  }
}
</style>
