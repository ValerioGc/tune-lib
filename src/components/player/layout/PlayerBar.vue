<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import CoverImage from '@/components/library/CoverImage.vue';
import PlayerControls from '@/components/player/controls/PlayerControls.vue';
import PlayerProgress from '@/components/player/controls/PlayerProgress.vue';
import PlayerSideControls from '@/components/player/controls/PlayerSideControls.vue';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { TrackView } from '@/types/library';

const props = defineProps<{ track: TrackView }>();

const emit = defineEmits<{
  expand: [];
  close: [];
}>();

const { t } = useI18n();
const player = usePlayerStore();
const settings = useSettingsStore();

/**
 * The line under the artist: what places the track without repeating it.
 *
 * Album and year are written together, and either of them may be missing, so the line only
 * appears when there is something to put on it.
 */
const placement = computed(() =>
  [props.track.album, props.track.year]
    .filter((part) => part !== null && `${part}` !== '')
    .join(' · '),
);

const accentStyle = computed(() => ({
  '--player_surface_strength': `${100 - settings.playerTransparency}%`,
  '--player_blur': `${settings.playerBlur}px`,
  ...(settings.coverGradientEnabled && player.coverAccent !== null
    ? { '--cover_accent_gradient': player.coverAccent.surfaceGradient }
    : {}),
}));
</script>

<template>
  <section
    class="player_bar"
    :class="{
      player_bar_glass: settings.playerTransparency > 0 || settings.playerBlur > 0,
      player_bar_accented: settings.coverGradientEnabled && player.coverAccent !== null,
    }"
    :style="accentStyle"
    :aria-label="t('player.nowPlaying')"
    data-testid="player-bar"
  >
    <div class="player_bar_tab">
      <AppTooltip :text="t('player.expand')" align="center">
        <button
          class="player_bar_tab_button"
          type="button"
          :aria-label="t('player.expand')"
          data-testid="player-expand"
          @click="emit('expand')"
        >
          <AppIcon name="expand" />
        </button>
      </AppTooltip>
      <AppTooltip :text="t('player.close')" align="center">
        <button
          class="player_bar_tab_button"
          type="button"
          :aria-label="t('player.close')"
          data-testid="player-close"
          @click="emit('close')"
        >
          <AppIcon name="close" />
        </button>
      </AppTooltip>
    </div>

    <p v-if="player.errorKey !== null" class="player_bar_error" role="alert">
      {{ t(`player.errors.${player.errorKey}`) }}
    </p>

    <div class="player_bar_body">
      <div class="player_bar_track">
        <CoverImage :track="track" size="thumb" eager />

        <div class="player_bar_info">
          <p class="player_bar_label">{{ t('player.nowPlaying') }}</p>
          <p class="player_bar_title" :title="track.title">{{ track.title }}</p>
          <p class="player_bar_artist" :title="track.artist ?? t('library.row.unknown')">
            {{ track.artist ?? t('library.row.unknown') }}
          </p>
          <p v-if="placement !== ''" class="player_bar_placement" :title="placement">
            {{ placement }}
          </p>
        </div>
      </div>

      <div class="player_bar_playback">
        <PlayerControls
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
        <PlayerProgress
          :position="player.position"
          :duration="player.duration"
          @seek="player.seek($event)"
        />
      </div>

      <div class="player_bar_actions">
        <PlayerSideControls
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
.player_bar {
  display: flex;
  position: relative;
  flex-direction: column;
  padding: $space_sm $page_gutter;
  border-top: 1px solid var(--color_border);
  background-color: var(--color_surface);
  box-shadow: var(--shadow_raised);

  &_glass {
    background-color: color-mix(
      in srgb,
      var(--color_surface) var(--player_surface_strength),
      transparent
    );
    backdrop-filter: blur(var(--player_blur));
  }

  &_accented {
    background:
      var(--cover_accent_gradient),
      color-mix(in srgb, var(--color_surface) var(--player_surface_strength), transparent);
  }

  &_tab {
    display: flex;
    position: absolute;
    right: 0;
    bottom: 100%;
    gap: $space_2xs;
    align-items: center;
    padding: $space_2xs $space_sm $space_2xs $space_md;
    border: 1px solid var(--color_border);
    border-right: 0;
    border-bottom: 0;
    background-color: var(--color_surface);
    clip-path: polygon(0.75rem 0, 100% 0, 100% 100%, 0 100%);

    &_button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 1.9rem;
      border: 0;
      border-radius: $radius_sm;
      background: none;
      color: var(--color_text_muted);
      font: inherit;
      font-size: 0.95em;
      cursor: pointer;
      transition:
        background-color $duration_fast ease,
        color $duration_fast ease;

      &:hover {
        background-color: var(--color_surface_hover);
        color: var(--color_text);
      }

      @include focus_ring;
    }
  }

  &_glass &_tab {
    background-color: color-mix(
      in srgb,
      var(--color_surface) var(--player_surface_strength),
      transparent
    );
    backdrop-filter: blur(var(--player_blur));
  }

  &_error {
    padding-bottom: $space_xs;
    color: var(--color_danger);
    font-size: 0.875em;
  }

  &_body {
    display: flex;
    gap: $space_md;
    align-items: center;
  }

  &_track {
    display: flex;
    flex: 1 1 16rem;
    gap: $space_md;
    align-items: center;
    min-width: 0;

    :deep(.cover_image_thumb) {
      width: 3.25rem;
      height: 3.25rem;
      border-radius: $radius_md;
    }
  }

  &_playback {
    display: flex;
    flex: 2 1 24rem;
    gap: $space_md;
    align-items: center;
    min-width: 0;
  }

  &_info {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.3;
  }

  &_label {
    color: var(--color_text_muted);
    font-size: 0.625em;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &_title,
  &_artist,
  &_placement {
    @include selectable_text;

    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_title {
    font-size: 1.0625em;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  &_artist {
    color: var(--color_accent);
    font-size: 0.8125em;
    font-weight: 600;
  }

  &_placement {
    color: var(--color_text_muted);
    font-size: 0.75em;
  }

  &_actions {
    display: flex;
    gap: $space_sm;
    align-items: center;
  }
}
</style>
