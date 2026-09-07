<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import CoverPicker from '@/components/metadata/fields/CoverPicker.vue';
import GenreSelect from '@/components/metadata/fields/GenreSelect.vue';
import MetadataField from '@/components/metadata/fields/MetadataField.vue';
import { validateYear } from '@/services/metadata-validation';
import { useLibraryStore } from '@/stores/library';
import type { Cover, MetadataUpdate, TrackView } from '@/types/library';

type BulkField = 'artist' | 'album' | 'year' | 'genre';

const props = defineProps<{
  tracks: readonly TrackView[];
}>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const library = useLibraryStore();

const enabled = ref<Record<BulkField, boolean>>({
  artist: false,
  album: false,
  year: false,
  genre: false,
});
const draft = ref<Record<BulkField, string>>({
  artist: commonValue('artist'),
  album: commonValue('album'),
  year: commonValue('year'),
  genre: commonValue('genre'),
});
const pendingCover = ref<Cover | undefined>(undefined);

const yearError = computed(() => (enabled.value.year ? validateYear(draft.value.year) : null));
const hasMetadataChange = computed(() => Object.values(enabled.value).some(Boolean));
const canSave = computed(
  () =>
    props.tracks.length > 1 &&
    !library.isSaving &&
    yearError.value === null &&
    (hasMetadataChange.value || pendingCover.value !== undefined),
);

function commonValue(field: BulkField): string {
  const values = props.tracks.map((track) => {
    if (field === 'year') {
      return track.year === null ? '' : String(track.year);
    }

    return track[field] ?? '';
  });
  const first = values[0] ?? '';

  return values.every((value) => value === first) ? first : '';
}

function clean(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

function updateFor(track: TrackView): MetadataUpdate {
  const year = clean(draft.value.year);
  const editedYear = year === null ? null : Number(year);

  return {
    title: track.title,
    artist: enabled.value.artist ? clean(draft.value.artist) : track.artist,
    album: enabled.value.album ? clean(draft.value.album) : track.album,
    year: enabled.value.year ? editedYear : track.year,
    genre: enabled.value.genre ? clean(draft.value.genre) : track.genre,
  };
}

function onCoverSelected(cover: Cover) {
  pendingCover.value = cover;
}

async function save() {
  if (!canSave.value) {
    return;
  }

  if (hasMetadataChange.value) {
    for (const track of props.tracks) {
      if ((await library.saveMetadata(track.id, updateFor(track))) === null) {
        return;
      }
    }
  }

  if (pendingCover.value !== undefined) {
    for (const track of props.tracks) {
      if ((await library.saveCover(track.id, pendingCover.value)) === null) {
        return;
      }
    }
  }

  emit('close');
}
</script>

<template>
  <AppModal
    :open="true"
    :title="t('metadata.bulk.title', { count: tracks.length })"
    @close="emit('close')"
  >
    <form class="bulk_metadata_editor" data-testid="bulk-metadata-editor" @submit.prevent="save">
      <p class="bulk_metadata_editor_hint">{{ t('metadata.bulk.description') }}</p>

      <label class="bulk_metadata_editor_toggle">
        <input v-model="enabled.artist" type="checkbox" data-testid="bulk-enable-artist" />
        <span>{{ t('metadata.fields.artist') }}</span>
      </label>
      <MetadataField
        v-if="enabled.artist"
        v-model="draft.artist"
        :label="t('metadata.fields.artist')"
        :suggestions="library.artistSuggestions"
      />

      <label class="bulk_metadata_editor_toggle">
        <input v-model="enabled.album" type="checkbox" data-testid="bulk-enable-album" />
        <span>{{ t('metadata.fields.album') }}</span>
      </label>
      <MetadataField
        v-if="enabled.album"
        v-model="draft.album"
        :label="t('metadata.fields.album')"
        :suggestions="library.albumSuggestions"
      />

      <label class="bulk_metadata_editor_toggle">
        <input v-model="enabled.year" type="checkbox" data-testid="bulk-enable-year" />
        <span>{{ t('metadata.fields.year') }}</span>
      </label>
      <MetadataField
        v-if="enabled.year"
        v-model="draft.year"
        :label="t('metadata.fields.year')"
        :error="yearError === null ? null : t(`metadata.errors.${yearError}`)"
        placeholder="1999"
      />

      <label class="bulk_metadata_editor_toggle">
        <input v-model="enabled.genre" type="checkbox" data-testid="bulk-enable-genre" />
        <span>{{ t('metadata.fields.genre') }}</span>
      </label>
      <GenreSelect
        v-if="enabled.genre"
        v-model="draft.genre"
        :label="t('metadata.fields.genre')"
        :custom-label="t('metadata.fields.genreCustom')"
        :genres="library.genreSuggestions"
      />

      <CoverPicker :current="null" @select="onCoverSelected" />
    </form>

    <template #actions>
      <AppButton :disabled="library.isSaving" @click="emit('close')">
        {{ t('metadata.cancel') }}
      </AppButton>
      <AppButton
        variant="primary"
        :disabled="!canSave"
        data-testid="bulk-metadata-save"
        @click="save"
      >
        {{ library.isSaving ? t('metadata.saving') : t('metadata.save') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.bulk_metadata_editor {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  text-align: left;

  &_hint {
    color: var(--color_text_muted);
  }

  &_toggle {
    display: flex;
    gap: $space_sm;
    align-items: center;
    color: var(--color_text);
    cursor: pointer;

    input {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color_accent);
    }
  }
}
</style>
