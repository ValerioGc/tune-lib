<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import { formatDuration } from '@/services/track-sorting';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import type { TrackView } from '@/types/library';

/** Which field of the playing track the list is gathered by. */
export type RelatedField = 'artist' | 'album' | 'genre';

const props = defineProps<{
  field: RelatedField | null;
  value: string | null;
}>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const library = useLibraryStore();
const player = usePlayerStore();

function valueOf(track: TrackView, field: RelatedField): string {
  return track[field]?.trim().toLowerCase() ?? '';
}

/** Every track of the library that shares the field with the one playing. */
const related = computed<TrackView[]>(() => {
  const { field, value } = props;

  if (field === null || value === null) {
    return [];
  }

  const needle = value.trim().toLowerCase();

  return library.tracks.filter((track) => valueOf(track, field) === needle);
});

async function play(track: TrackView) {
  // The whole group becomes the queue: from here the playback carries on through it.
  await player.playFrom(related.value, track.id);
}
</script>

<template>
  <AppModal
    :open="field !== null"
    :title="t('library.groups.modalTitle', { name: value ?? '' })"
    wide
    glass
    @close="emit('close')"
  >
    <div class="player_related">
      <p v-if="related.length === 0" class="player_related_empty" data-testid="related-empty">
        {{ t('player.related.empty') }}
      </p>

      <ul v-else class="player_related_list common_scroll_area">
        <li
          v-for="track in related"
          :key="track.id"
          class="player_related_item"
          :class="{ player_related_item_playing: track.id === player.currentTrack?.id }"
        >
          <button
            class="player_related_play"
            type="button"
            :aria-label="t('player.related.play', { title: track.title })"
            :aria-current="track.id === player.currentTrack?.id ? 'true' : undefined"
            :data-testid="`related-play-${track.id}`"
            @click="play(track)"
          >
            <CoverImage class="player_related_cover" :track="track" size="thumb" />

            <span class="player_related_names">
              <span class="player_related_title">{{ track.title }}</span>
              <span class="player_related_meta">
                {{ track.artist ?? t('library.row.unknown') }}
                <span aria-hidden="true"> · </span>
                {{ track.album ?? t('library.row.unknown') }}
              </span>
            </span>

            <span class="player_related_duration">{{ formatDuration(track.durationMs) }}</span>
            <AppIcon :name="track.id === player.currentTrack?.id ? 'pause' : 'play'" />
          </button>
        </li>
      </ul>
    </div>

    <template #actions>
      <AppButton variant="primary" @click="emit('close')">
        {{ t('library.groups.close') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.player_related {
  display: flex;
  flex-direction: column;
  gap: $space_sm;

  &_empty {
    color: var(--color_text_muted);
  }

  &_list {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    max-height: min(26rem, 52vh);
    margin: 0;
    padding-right: $space_xs;
    padding-left: 0;
    list-style: none;
  }

  &_play {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: $space_md;
    align-items: center;
    width: 100%;
    padding: $space_xs $space_sm;
    border: 0;
    border-radius: $radius_md;
    background: none;
    color: var(--color_text);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background-color: var(--row_hover_background);
    }

    @include focus_ring;
  }

  &_item_playing &_play {
    background-color: var(--row_selected_background);
  }

  &_cover {
    flex-shrink: 0;
  }

  &_names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &_title {
    @include selectable_text;

    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_meta {
    @include selectable_text;

    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.875em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_duration {
    color: var(--color_text_muted);
    font-variant-numeric: tabular-nums;
  }
}
</style>
