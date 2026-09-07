<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import { duplicateGroups } from '@/services/duplicate-tracks';
import { formatDuration } from '@/services/track-sorting';
import { useLibraryStore } from '@/stores/library';
import type { TrackView } from '@/types/library';

defineProps<{ open: boolean }>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const library = useLibraryStore();

const groups = computed(() => duplicateGroups(library.tracks));

async function remove(track: TrackView) {
  await library.remove(track.id);
}
</script>

<template>
  <AppModal :open="open" :title="t('library.duplicates.title')" wide @close="emit('close')">
    <div class="library_duplicates">
      <p class="library_duplicates_description">{{ t('library.duplicates.description') }}</p>

      <p v-if="groups.length === 0" class="library_duplicates_empty" data-testid="duplicates-empty">
        {{ t('library.duplicates.empty') }}
      </p>

      <ul v-else class="library_duplicates_groups common_scroll_area">
        <li
          v-for="group in groups"
          :key="group.key"
          class="library_duplicates_group common_surface_alt"
        >
          <h3 class="library_duplicates_name">
            <span class="library_duplicates_title">{{ group.title }}</span>
            <span class="library_duplicates_artist">
              {{ group.artist ?? t('library.row.unknown') }}
            </span>
            <span class="library_duplicates_count">
              {{ t('library.duplicates.copies', { count: group.tracks.length }) }}
            </span>
          </h3>

          <ul class="library_duplicates_files">
            <li
              v-for="track in group.tracks"
              :key="track.id"
              class="library_duplicates_file"
              :class="{ library_duplicates_file_missing: track.missing }"
              :data-testid="`duplicate-${track.id}`"
            >
              <span class="library_duplicates_path" :title="track.path">
                <!-- A copy whose file has already gone is still a copy of the group, and
                     still worth taking out of the library: it is marked, not hidden. -->
                <AppIcon
                  v-if="track.missing"
                  class="library_duplicates_missing"
                  name="warning"
                  :label="t('library.row.missing')"
                  :data-testid="`duplicate-missing-${track.id}`"
                />
                <span class="library_duplicates_text" :title="track.path">{{ track.path }}</span>
              </span>
              <span class="library_duplicates_meta">
                {{ track.album ?? t('library.row.unknown') }}
                <span aria-hidden="true"> · </span>
                {{ track.format.toUpperCase() }}
                <span aria-hidden="true"> · </span>
                {{ formatDuration(track.durationMs) }}
              </span>
              <AppButton
                variant="danger"
                :aria-label="t('library.duplicates.remove', { title: track.title })"
                data-testid="duplicate-remove"
                @click="remove(track)"
              >
                <AppIcon name="remove" />
              </AppButton>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <template #actions>
      <AppButton variant="primary" @click="emit('close')">
        {{ t('library.duplicates.close') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.library_duplicates {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_description,
  &_empty {
    color: var(--color_text_muted);
  }

  &_groups {
    display: flex;
    flex-direction: column;
    gap: $space_md;
    max-height: min(26rem, 52vh);
    margin: 0;
    padding-right: $space_xs;
    padding-left: 0;
    list-style: none;
  }

  &_group {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
    padding: $space_md;
  }

  &_name {
    display: flex;
    flex-wrap: wrap;
    gap: $space_xs $space_sm;
    align-items: baseline;
    min-width: 0;
    font-size: 1em;
  }

  &_title {
    @include selectable_text;

    font-weight: 700;
  }

  &_artist {
    @include selectable_text;

    color: var(--color_text_muted);
  }

  &_count {
    padding: 0 $space_sm;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_sm;
    color: var(--color_text_muted);
    font-size: 0.75em;
  }

  &_files {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    margin: 0;
    padding-left: 0;
    list-style: none;
  }

  &_file {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: $space_sm $space_md;
    align-items: center;
    padding: $space_xs $space_sm;
    border-radius: $radius_sm;
    background-color: var(--color_surface);
  }

  &_path {
    display: flex;
    gap: $space_xs;
    align-items: center;
    min-width: 0;
    font-size: 0.875em;
  }

  &_text {
    @include selectable_text;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_missing {
    flex-shrink: 0;
    color: var(--color_danger);
  }

  &_file_missing {
    color: var(--color_text_muted);
  }

  &_meta {
    color: var(--color_text_muted);
    font-size: 0.8125em;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    &_file {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    &_meta {
      grid-column: 1 / -1;
    }
  }
}
</style>
