<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import { useOverlay } from '@/composables/useForeground';
import CoverImage from '@/components/library/CoverImage.vue';
import PlayerControls from '@/components/player/controls/PlayerControls.vue';
import PlayerProgress from '@/components/player/controls/PlayerProgress.vue';
import PlayerRelatedDialog, {
  type RelatedField,
} from '@/components/player/PlayerRelatedDialog.vue';
import PlayerSideControls from '@/components/player/controls/PlayerSideControls.vue';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { TrackView } from '@/types/library';

const props = withDefaults(
  defineProps<{
    track: TrackView;
    showLibraryLink?: boolean;
  }>(),
  { showLibraryLink: false },
);

const emit = defineEmits<{
  collapse: [];
  close: [];
  openLibrary: [];
}>();

const { t } = useI18n();
const player = usePlayerStore();
const settings = useSettingsStore();

// The full view is drawn over the library: it exists only while it covers it.
useOverlay(() => true);

/**
 * Everything that is not title and artist goes under the cover.
 *
 * Album and genre gather other tracks, so they open the list of what they hold: the year
 * gathers nothing worth listening through, and stays plain text.
 */
const details = computed(() => [
  { key: 'album', value: props.track.album, field: 'album' as RelatedField | null },
  { key: 'year', value: props.track.year, field: null },
  { key: 'genre', value: props.track.genre, field: 'genre' as RelatedField | null },
]);

const related = ref<{ field: RelatedField; value: string } | null>(null);

function openRelated(field: RelatedField, value: string | null) {
  if (value !== null && value.trim() !== '') {
    related.value = { field, value };
  }
}

const accentStyle = computed(() => ({
  '--player_surface_strength': `${100 - settings.playerTransparency}%`,
  '--player_blur': `${settings.playerBlur}px`,
  ...(settings.coverGradientEnabled && player.coverAccent !== null
    ? { '--cover_accent_gradient': player.coverAccent.surfaceGradient }
    : {}),
}));

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (props.showLibraryLink) {
      emit('openLibrary');
    } else {
      emit('collapse');
    }
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <section
    class="player_full"
    :class="{
      player_full_glass: settings.playerTransparency > 0 || settings.playerBlur > 0,
      player_full_accented: settings.coverGradientEnabled && player.coverAccent !== null,
    }"
    :style="accentStyle"
    :aria-label="t('player.nowPlaying')"
    data-testid="player-full"
  >
    <header class="player_full_header">
      <div class="player_full_header_start">
        <AppButton
          v-if="showLibraryLink"
          variant="ghost"
          data-testid="open-library-from-player"
          @click="emit('openLibrary')"
        >
          <AppIcon name="back" />
          {{ t('player.openLibrary') }}
        </AppButton>
      </div>

      <span class="player_full_label">{{ t('player.nowPlaying') }}</span>

      <div class="player_full_header_actions">
        <AppTooltip :text="t('player.collapse')">
          <AppButton
            variant="ghost"
            :aria-label="t('player.collapse')"
            data-testid="player-collapse"
            @click="emit('collapse')"
          >
            <AppIcon name="collapse" />
          </AppButton>
        </AppTooltip>

        <AppTooltip :text="t('player.close')">
          <AppButton
            variant="ghost"
            :aria-label="t('player.close')"
            data-testid="player-full-close"
            @click="emit('close')"
          >
            <AppIcon name="close" />
          </AppButton>
        </AppTooltip>
      </div>
    </header>

    <div class="player_full_body common_scroll_area_centered">
      <div class="player_full_stage">
        <div class="player_full_heading">
          <h1 class="player_full_title" :title="track.title">{{ track.title }}</h1>

          <p class="player_full_artist">
            <button
              v-if="track.artist !== null"
              class="player_full_link"
              type="button"
              :aria-label="t('library.groups.openLabel', { name: track.artist })"
              data-testid="player-open-artist"
              @click="openRelated('artist', track.artist)"
            >
              {{ track.artist }}
            </button>
            <span v-else>{{ t('library.row.unknown') }}</span>
          </p>
        </div>

        <div class="player_full_cover">
          <CoverImage :track="track" size="card" eager />
        </div>

        <!-- Keep each metadata field readable on its own row, especially when album names are
             longer than the player width. -->
        <dl class="player_full_details">
          <div v-for="detail in details" :key="detail.key" class="player_full_detail">
            <dt class="player_full_detail_label">{{ t(`library.columns.${detail.key}`) }}</dt>
            <dd class="player_full_detail_value">
              <button
                v-if="detail.field !== null && detail.value !== null"
                class="player_full_link"
                type="button"
                :aria-label="t('library.groups.openLabel', { name: detail.value })"
                :data-testid="`player-open-${detail.key}`"
                @click="openRelated(detail.field, String(detail.value))"
              >
                {{ detail.value }}
              </button>
              <span v-else>{{ detail.value ?? t('library.row.unknown') }}</span>
            </dd>
          </div>
        </dl>
      </div>

      <PlayerRelatedDialog
        :field="related?.field ?? null"
        :value="related?.value ?? null"
        @close="related = null"
      />

      <p v-if="player.errorKey !== null" class="player_full_error" role="alert">
        {{ t(`player.errors.${player.errorKey}`) }}
      </p>

      <!-- The transport is read from its centre, so nothing shares its line: the progress
           runs above it and the secondary controls sit under it, each on a row of its own
           and each centred on the same axis as play. -->
      <div class="player_full_playback common_glass_lg">
        <PlayerProgress
          :position="player.position"
          :duration="player.duration"
          @seek="player.seek($event)"
        />

        <PlayerControls
          class="player_full_transport"
          prominent
          :is-playing="player.isPlaying"
          :has-next="player.hasNext"
          :is-shuffle-enabled="player.isShuffleEnabled"
          :is-repeat-one-enabled="player.isRepeatOneEnabled"
          :disabled="player.isLoading"
          @previous="player.previous()"
          @toggle="player.toggle()"
          @next="player.next()"
          @toggle-shuffle="player.toggleShuffle()"
          @toggle-repeat-one="player.toggleRepeatOne()"
        />

        <PlayerSideControls
          class="player_full_secondary"
          :volume="player.volume"
          :muted="player.isMuted"
          :disabled="player.isLoading"
          @stop="player.stop()"
          @toggle-mute="player.toggleMute()"
          @update:volume="player.setVolume($event)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.player_full {
  /* The titlebar stays reachable: window controls, settings and guide are on it. */
  position: fixed;
  top: $titlebar_height;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background-color: var(--color_bg);

  &_glass {
    background-color: color-mix(
      in srgb,
      var(--color_bg) var(--player_surface_strength),
      transparent
    );
    backdrop-filter: blur(var(--player_blur));
  }

  &_accented {
    background:
      var(--cover_accent_gradient),
      color-mix(in srgb, var(--color_bg) var(--player_surface_strength), transparent);
  }

  &_header {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: $space_sm $page_gutter;
  }

  &_header_start,
  &_header_actions {
    display: flex;
    flex: 1;
    align-items: center;
  }

  &_header_actions {
    justify-content: flex-end;
  }

  &_label {
    color: var(--color_text_muted);
    font-size: 0.875em;
    letter-spacing: 0.02em;
  }

  &_body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space_lg;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: $space_md $page_gutter $space_xl;
    text-align: center;
  }

  // Title, cover and details form one block, so they stay together while the transport
  // keeps its own space at the bottom.
  &_stage {
    display: flex;
    flex-direction: column;
    gap: $space_md;
    align-items: center;
    width: 100%;
    max-width: min(52rem, calc(100vw - #{$page_gutter} - #{$page_gutter}));
  }

  &_heading {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    width: 100%;
    max-width: min(52rem, 100%);
  }

  &_title {
    @include selectable_text;

    overflow: hidden;
    font-size: 1.6em;
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  &_artist {
    @include selectable_text;

    color: var(--color_accent);
    font-size: 1.0625em;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  // What gathers other tracks opens on a click, but is written as plain text: no
  // underline, no link colour of its own beyond the one its line already carries.
  &_link {
    max-width: 100%;
    // The padding is given back as margin, so the text stays where it was written.
    margin: 0 calc(#{$space_2xs} * -1);
    padding: 0 $space_2xs;
    border: 0;
    border-radius: $radius_sm;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      color $duration_fast ease;

    // The answer to the pointer is a surface under the words, not an underline.
    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_accent);
    }

    @include focus_ring;
  }

  &_cover {
    width: min(19rem, 46vh);
    border-radius: $radius_lg;
    box-shadow: var(--shadow_raised);
    overflow: hidden;
  }

  &_details {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    align-items: stretch;
    width: 100%;
    max-width: min(52rem, 100%);
    margin: 0;
  }

  &_detail {
    display: flex;
    gap: $space_md;
    align-items: baseline;
    min-width: 0;
    padding: $space_xs $space_sm;
    border-bottom: 1px solid var(--color_border);

    &_label {
      flex: 0 0 5rem;
      color: var(--color_text_muted);
      font-size: 0.7em;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    &_value {
      @include selectable_text;

      flex: 1;
      min-width: 0;
      margin: 0;
      font-size: 0.9375em;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
  }

  &_error {
    color: var(--color_danger);
  }

  // A panel of its own under the cover: the controls stop floating on the page and read as
  // one block, whatever the background behind them is doing.
  &_playback {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
    align-items: center;
    width: min(34rem, 100%);
    padding: $space_sm $space_md $space_md;
  }

  &_transport {
    justify-content: center;
  }

  // Quieter than the transport and set apart from it: stop and the volume are not steps
  // through the queue, and standing them on their own line says so.
  &_secondary {
    justify-content: center;
    padding-top: $space_xs;
    border-top: 1px solid var(--color_border);
    width: 100%;
  }

  :deep(.player_progress) {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .player_full {
    &_detail + &_detail {
      padding-left: 0;
      border-left: 0;
    }
  }
}
</style>
