<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import PlayingBubble from '@/components/library/PlayingBubble.vue';
import type { TrackView } from '@/types/library';

/** One entry of the carousel: an album or an artist gathered from the open group. */
export interface CarouselGroup {
  key: string;
  name: string;
  /** Second line of the card: the year of an album, the track count of an artist. */
  meta: string | null;
  coverTrack: TrackView | null;
  playing: boolean;
}

const props = defineProps<{
  title: string;
  groups: readonly CarouselGroup[];
}>();

const emit = defineEmits<{ open: [key: string] }>();

const { t } = useI18n();
</script>

<template>
  <section class="library_group_carousel" :aria-label="props.title">
    <header class="library_group_carousel_header">
      <h3 class="library_group_carousel_title">{{ props.title }}</h3>
    </header>

    <ul class="library_group_carousel_track">
      <li v-for="group in props.groups" :key="group.key" class="library_group_carousel_item">
        <button
          class="library_group_carousel_card common_glass"
          :class="{ library_group_carousel_card_playing: group.playing }"
          type="button"
          :aria-label="t('library.groups.openLabel', { name: group.name })"
          :aria-current="group.playing ? 'true' : undefined"
          @click="emit('open', group.key)"
        >
          <PlayingBubble v-if="group.playing" />

          <CoverImage
            v-if="group.coverTrack !== null"
            class="library_group_carousel_cover"
            :track="group.coverTrack"
            size="card"
            eager
          />
          <!-- A group with nothing to show still holds its square, so the cards line up. -->
          <span v-else class="library_group_carousel_cover library_group_carousel_empty">
            <AppIcon name="note" :label="t('library.row.noCover')" />
          </span>
          <span class="library_group_carousel_name" :title="group.name">{{ group.name }}</span>
          <!-- The line is kept even when empty: without it a card without a year would
               stand shorter than the ones beside it. -->
          <span class="library_group_carousel_meta">{{ group.meta ?? '' }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.library_group_carousel {
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  min-width: 0;

  &_header {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
  }

  &_title {
    color: var(--color_text);
    font-size: 0.95em;
    font-weight: 700;
  }

  &_track {
    display: flex;
    gap: $space_md;
    min-width: 0;
    margin: 0;
    padding-bottom: $space_xs;
    padding-left: 0;
    overflow-x: auto;
    list-style: none;
    scroll-snap-type: x proximity;
  }

  &_item {
    display: flex;
    flex: 0 0 auto;
  }

  // `min-width: 0` is what makes the width above hold. A flex item is allowed to grow past
  // its basis to fit its content, and the name below does not wrap: an album called
  // "Musica per ciechi muti e sordi" would widen its card, and the cover with it, while the
  // one beside it stayed narrow.
  &_card {
    display: flex;
    position: relative;
    flex: 0 0 8.5rem;
    flex-direction: column;
    min-width: 0;
    gap: $space_xs;
    padding: $space_sm;
    color: var(--color_text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    scroll-snap-align: start;
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
  }

  &_cover {
    width: 100%;
    flex-shrink: 0;
  }

  &_empty {
    display: flex;
    position: relative;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_surface_alt);
    color: var(--color_text_muted);
    font-size: 2rem;

    &::before {
      flex: 0 0 auto;
      width: 0;
      padding-bottom: 100%;
      content: '';
    }

    > * {
      position: absolute;
      display: flex;
      inset: 0;
      align-items: center;
      justify-content: center;
    }
  }

  &_name,
  &_meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_name {
    font-size: 0.875em;
    font-weight: 700;
  }

  &_meta {
    min-height: 1.2em;
    color: var(--color_text_muted);
    font-size: 0.8em;
    font-variant-numeric: tabular-nums;
  }
}

@media (max-width: 640px) {
  .library_group_carousel_card {
    flex-basis: 7.5rem;
  }
}
</style>
