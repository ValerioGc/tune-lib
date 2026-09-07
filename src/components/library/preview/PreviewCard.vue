<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import LibraryRowActions from '@/components/library/table/LibraryRowActions.vue';
import MissingBubble from '@/components/library/MissingBubble.vue';
import PlayingBubble from '@/components/library/PlayingBubble.vue';
import type { TrackSelectionIntent, TrackView } from '@/types/library';

/** The lines the card carries under its title. */
export type PreviewCardMeta = 'artist' | 'album';

const props = withDefaults(
  defineProps<{
    track: TrackView;
    selected: boolean;
    playing: boolean;
    /** Dropped where the modal already names them, as an album does in its header. */
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

const { t } = useI18n();

function select(event: MouseEvent) {
  emit('select', {
    id: props.track.id,
    additive: event.ctrlKey || event.metaKey,
    range: event.shiftKey,
  });
}
</script>

<template>
  <div
    class="preview_card common_glass_lg"
    :class="{
      preview_card_selected: selected,
      preview_card_missing: track.missing,
      preview_card_playing: playing,
    }"
  >
    <!-- The whole card selects, but only a button can carry the click: the card holds the
         actions menu, which a listbox option is not allowed to contain. The button covers
         the card, so the title hangs from it to be read anywhere on the cover. -->
    <AppTooltip class="preview_card_hover" :text="track.title" align="center">
      <button
        class="preview_card_select"
        type="button"
        :aria-pressed="selected"
        :aria-current="playing ? 'true' : undefined"
        :aria-label="track.title"
        @click="select($event)"
        @dblclick="emit('play', track)"
      />
    </AppTooltip>

    <PlayingBubble v-if="playing" />
    <MissingBubble v-if="track.missing" />

    <CoverImage :track="track" size="card" />

    <div class="preview_card_body">
      <h3 class="preview_card_title" :title="track.title">{{ track.title }}</h3>
      <p v-if="metaKeys.includes('artist')" class="preview_card_meta" :title="track.artist ?? ''">
        {{ track.artist ?? t('library.row.unknown') }}
      </p>
      <p v-if="metaKeys.includes('album')" class="preview_card_meta">
        {{ track.album ?? t('library.row.unknown') }}
      </p>
    </div>

    <!-- Same menu as the list view, so both views offer the same actions. -->
    <div class="preview_card_actions">
      <LibraryRowActions
        :track="track"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.preview_card {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space_sm;
  min-width: 0;
  padding: $space_sm;
  transition:
    background-color $duration_fast ease,
    border-color $duration_fast ease;

  &:hover {
    background-color: var(--row_hover_background);
  }

  // The button covers the card so the whole surface stays clickable, and it sits under the
  // menu so the actions keep their own clicks.
  // The tooltip is the anchor of the hover, so it takes the card over and the button fills it.
  &_hover {
    position: absolute;
    z-index: 1;
    inset: 0;
  }

  &_select {
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: inherit;
    background: none;
    cursor: pointer;

    @include focus_ring;
  }

  &_selected {
    border-color: var(--color_accent);
    background-color: var(--row_selected_background);
  }

  &_missing {
    color: var(--color_text_muted);

    // The cover is the part that has nothing left behind it: dimming it says so without
    // spending a line of the body on a sentence.
    :deep(.cover_image) {
      opacity: 0.55;
    }
  }

  &_playing {
    border-color: var(--color_accent);
    box-shadow: inset 0 0 0 1px var(--color_accent);
    background-color: var(--row_selected_background);
  }

  &_body {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    min-width: 0;
  }

  &_title {
    @include selectable_text;

    overflow: hidden;
    font-size: 0.9375em;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_meta {
    @include selectable_text;

    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.8125em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  // The menu takes the same corner: reading the state matters while the card is at rest,
  // acting on it matters while the pointer is on the card.
  &:hover :deep(.playing_bubble),
  &:focus-within :deep(.playing_bubble) {
    opacity: 0;
  }

  &_actions {
    position: absolute;
    z-index: 3;
    top: $space_sm;
    right: $space_sm;
    border-radius: $radius_md;
    background-color: var(--surface_glass_background);
    opacity: 0;
    transition: opacity $duration_fast ease;
  }

  // The menu stays visible while it is open, otherwise it would vanish under the pointer.
  &:hover &_actions,
  &:focus-within &_actions,
  &_actions:has([aria-expanded='true']) {
    opacity: 1;
  }
}
</style>
