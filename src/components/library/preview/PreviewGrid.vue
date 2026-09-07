<script setup lang="ts">
import { computed } from 'vue';

import PreviewCard, { type PreviewCardMeta } from '@/components/library/preview/PreviewCard.vue';
import { trackCardWidth } from '@/services/preview-size';
import { useSettingsStore } from '@/stores/settings';
import type { TrackSelectionIntent, TrackView } from '@/types/library';

withDefaults(
  defineProps<{
    tracks: readonly TrackView[];
    selectedIds: readonly string[];
    playingId: string | null;
    metaKeys?: readonly PreviewCardMeta[];
  }>(),
  { metaKeys: () => ['artist', 'album'] },
);

const emit = defineEmits<{
  select: [intent: TrackSelectionIntent];
  play: [track: TrackView];
  edit: [track: TrackView];
  remove: [track: TrackView];
}>();

const settings = useSettingsStore();

// The floor the grid fills the row against: how many cards fit on a line is what the size
// really decides.
const cardWidth = computed(() => trackCardWidth(settings.previewSizes.tracks));
</script>

<template>
  <ul class="preview_grid common_scroll_area" :style="{ '--preview_card_width': cardWidth }">
    <li v-for="track in tracks" :key="track.id" class="preview_grid_item">
      <PreviewCard
        :track="track"
        :meta-keys="metaKeys"
        :selected="selectedIds.includes(track.id)"
        :playing="track.id === playingId"
        @select="emit('select', $event)"
        @play="emit('play', $event)"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />
    </li>
  </ul>
</template>

<style scoped lang="scss">
.preview_grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--preview_card_width, 9rem), 1fr));
  // `align-content: start` is what keeps the rows the height of their cards: without it a
  // grid shares the free space among them, which a short list has plenty of.
  //
  // Sizing the rows by `min-content` did the same thing and one thing more: the square of a
  // cover is held by a percentage padding, and percentages count as zero while a browser
  // measures intrinsic height. Every row came out as tall as its text alone, and each card
  // spilled its cover over the row below — where it covered the text, except on the last
  // row, which had nothing under it to hide.
  align-content: start;
  gap: $space_md;
  flex: 1;
  min-height: 0;
  margin: 0;
  padding-bottom: $space_md;
  padding-left: 0;
  overflow-x: hidden;
  list-style: none;

  // The item is a grid track first: without a floor of its own it grows to the width of the
  // longest line of its card, which pushes the grid into a sideways scroll.
  &_item {
    display: flex;
    min-width: 0;
  }
}
</style>
