<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppSkeleton from '@/components/common/placeholder/AppSkeleton.vue';
import PlayerProgress from '@/components/player/controls/PlayerProgress.vue';
import PlayerVolume from '@/components/player/controls/PlayerVolume.vue';
import {
  onCloseQuestionOpen,
  onPlayerState,
  sendMiniCommand,
  type MiniPlayerCommand,
  type MiniPlayerState,
} from '@/services/mini-player-bridge';
import { closeMiniPlayer, openMiniCloseConfirmation } from '@/services/shell-integration';
import { onWindowMoved, windowPosition } from '@/services/window-controls';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const state = ref<MiniPlayerState | null>(null);
const isClosing = ref(false);
const isAsking = ref(false);
const isSheetOpen = ref(false);
const remembers = ref(false);
let unlistenState: (() => void) | null = null;
let unlistenMoved: (() => void) | null = null;
let unlistenCloseQuestion: (() => void) | null = null;
let positionPersistenceTimer: ReturnType<typeof setTimeout> | null = null;

const isVertical = computed(() => settings.miniPlayerOrientation === 'vertical');
const isExpanded = computed(() => settings.miniPlayerLevel === 'expanded');

/**
 * The transport, before there is anything to play with it.
 *
 * The dock is opened before the main window has said what it is playing, and controls drawn
 * dead — greyed out, then filled in a moment later — read as a dock that has broken rather
 * than one that is listening. Each placeholder takes the room of the button it stands in
 * for, so nothing moves when the answer arrives.
 */
const controlPlaceholders = computed(() =>
  isExpanded.value ? ['1.9rem', '2.4rem', '1.9rem', '1.9rem'] : ['1.9rem', '2.4rem', '1.9rem'],
);

function schedulePositionPersistence(position: { x: number; y: number }) {
  if (positionPersistenceTimer !== null) {
    clearTimeout(positionPersistenceTimer);
  }

  positionPersistenceTimer = setTimeout(() => {
    positionPersistenceTimer = null;
    settings.setMiniPlayerPosition(position).catch((error: unknown) => {
      console.error('Writing down the dock position failed', error);
    });
  }, 120);
}

function closeSheet() {
  isSheetOpen.value = false;
}

function closeSheetOnOutside(event: MouseEvent) {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest('[data-testid="mini-sheet"]') || target.closest('[data-testid="mini-menu"]')) {
    return;
  }

  closeSheet();
}

/** The colour of the cover, painted behind the dock when the setting asks for it. */
const gradientStyle = computed(() =>
  state.value?.gradient === null || state.value === null
    ? {}
    : { backgroundImage: state.value.gradient },
);

/** How far along the track is, as the share of the bar that is filled. */
const progressStyle = computed(() => {
  const duration = state.value?.duration ?? 0;
  const share = duration > 0 ? ((state.value?.position ?? 0) / duration) * 100 : 0;

  return { '--mini_progress': `${Math.min(100, Math.max(0, share))}%` };
});

onMounted(async () => {
  document.addEventListener('click', closeSheetOnOutside);

  // The dock reads the same settings file as the app, so theme, accent and text size follow.
  await settings.initialize();
  unlistenState = await onPlayerState((received) => {
    state.value = received;
  });

  // The state event may have been emitted before this separate webview started listening.
  // Asking for a fresh snapshot also carries the cover gradient into a newly opened dock.
  await sendMiniCommand('sync', settings.miniPlayerAlwaysOnTop ? 1 : 0);

  // The question of closing is asked in a window of its own: while it stands, the dock is
  // dimmed and answers nothing but a click that brings the question back to the front.
  unlistenCloseQuestion = await onCloseQuestionOpen((open) => {
    isAsking.value = open;
  });

  // Wherever it is left is where it comes back: the position is written down as it moves.
  unlistenMoved = await onWindowMoved((position) => {
    // A resize can emit a transient move before the shell restores the anchored edge. Only
    // remember the settled position, otherwise that intermediate coordinate becomes the next
    // starting point.
    schedulePositionPersistence(position);
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeSheetOnOutside);
  unlistenState?.();
  unlistenMoved?.();
  unlistenCloseQuestion?.();
  unlistenCloseQuestion = null;
  if (positionPersistenceTimer !== null) {
    clearTimeout(positionPersistenceTimer);
    positionPersistenceTimer = null;
  }
  unlistenState = null;
  unlistenMoved = null;
  settings.dispose();
});

/** The second level is a choice of the moment, unless the settings ask to keep it. */
async function toggleLevel() {
  isSheetOpen.value = false;

  await settings.setMiniPlayerLevel(
    isExpanded.value ? 'compact' : 'expanded',
    settings.miniPlayerRemembersLevel,
  );
}

async function toggleOrientation() {
  isSheetOpen.value = false;
  await settings.setMiniPlayerOrientation(isVertical.value ? 'horizontal' : 'vertical');
}

async function toggleOnTop() {
  isSheetOpen.value = false;
  await settings.setMiniPlayerAlwaysOnTop(!settings.miniPlayerAlwaysOnTop);
  await sendMiniCommand('sync', settings.miniPlayerAlwaysOnTop ? 1 : 0);
}

async function runMiniCommand(action: MiniPlayerCommand['action'], value?: number) {
  isSheetOpen.value = false;

  if (value === undefined) {
    await sendMiniCommand(action);
    return;
  }

  await sendMiniCommand(action, value);
}

/** Writes down where the dock stands, ahead of any write still waiting on the timer. */
async function persistPosition() {
  if (positionPersistenceTimer !== null) {
    clearTimeout(positionPersistenceTimer);
    positionPersistenceTimer = null;
  }

  const position = await windowPosition();

  if (position !== null) {
    await settings.setMiniPlayerPosition(position);
  }
}

/** Closing the dock may or may not mean closing the app: the answer can be remembered. */
async function requestClose() {
  isSheetOpen.value = false;

  if (settings.miniPlayerCloseAction !== 'ask') {
    await close(settings.miniPlayerCloseAction === 'app');
    return;
  }

  // The question is asked in a window of its own, centred on the screen. Inside the dock
  // there is no room to read it: it is a few hundred pixels of transport controls, and a
  // question folded into that is a question nobody can answer with any confidence.
  //
  // That window owns the answer and applies it, this one included, so where the dock stands
  // is written down before it is opened rather than on the way out.
  await persistPosition();

  // A browser preview and the tests have no second window to open: there the question is
  // asked inside the dock, cramped but reachable.
  if (await openMiniCloseConfirmation()) {
    isAsking.value = true;
    return;
  }

  isClosing.value = true;
}

/** The question is already up: a click anywhere on the dock brings it back to the front. */
async function raiseQuestion() {
  await openMiniCloseConfirmation();
}

async function close(quitsApp: boolean, remember = remembers.value) {
  if (remember) {
    await settings.setMiniPlayerCloseAction(quitsApp ? 'app' : 'dock');
  }

  await persistPosition();

  isClosing.value = false;

  if (quitsApp) {
    await sendMiniCommand('quit');
    return;
  }

  await closeMiniPlayer();
}
</script>

<template>
  <div
    class="mini_player"
    :class="{
      mini_player_vertical: isVertical,
      mini_player_expanded: isExpanded,
      mini_player_loading: state === null,
      mini_player_accented: state?.gradient !== null && state?.gradient !== undefined,
    }"
    :style="{ ...gradientStyle, ...progressStyle }"
    :aria-busy="state === null"
    data-testid="mini-player"
    @click="closeSheet"
  >
    <!-- The window commands take the top line, out of the way of the transport. -->
    <div class="mini_player_bar" data-tauri-drag-region>
      <button
        class="mini_player_button"
        type="button"
        :aria-label="isExpanded ? t('mini.collapse') : t('mini.expandDock')"
        :aria-pressed="isExpanded"
        :disabled="state === null"
        data-testid="mini-level"
        @click="toggleLevel"
      >
        <AppIcon :name="isExpanded ? 'collapse' : 'expand'" />
      </button>

      <span class="mini_player_grip" data-tauri-drag-region></span>

      <button
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.menu.label')"
        :aria-expanded="isSheetOpen"
        data-testid="mini-menu"
        @click.stop="isSheetOpen = !isSheetOpen"
      >
        <AppIcon name="more" />
      </button>
      <button
        class="mini_player_button"
        :class="{ mini_player_button_active: settings.miniPlayerAlwaysOnTop }"
        type="button"
        :aria-label="settings.miniPlayerAlwaysOnTop ? t('mini.unpin') : t('mini.pin')"
        :aria-pressed="settings.miniPlayerAlwaysOnTop"
        data-testid="mini-pin"
        @click="toggleOnTop"
      >
        <AppIcon name="pin" />
      </button>
      <button
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.expand')"
        :disabled="state === null"
        data-testid="mini-expand"
        @click="runMiniCommand('expand')"
      >
        <AppIcon name="maximize" />
      </button>
      <button
        class="mini_player_button"
        type="button"
        :aria-label="t('mini.close')"
        data-testid="mini-close"
        @click="requestClose"
      >
        <AppIcon name="close" />
      </button>
    </div>

    <template v-if="!isClosing">
      <!-- The expanded view gives the track information its own line. The compact view keeps
           transport beside the title so the fixed-size dock stays quick to read. -->
      <div class="mini_player_track">
        <span class="mini_player_cover">
          <img v-if="state?.cover" :src="state.cover" alt="" />
          <AppSkeleton v-else-if="state === null" variant="box" width="100%" height="100%" />
          <AppIcon v-else name="note" />
        </span>

        <span class="mini_player_names">
          <span v-if="state !== null" class="mini_player_title">{{ state.title }}</span>
          <AppSkeleton v-else class="mini_player_skeleton_title" />
          <span v-if="state !== null" class="mini_player_artist">{{ state.artist ?? '' }}</span>
          <AppSkeleton v-else class="mini_player_skeleton_artist" />
          <span v-if="isExpanded && state?.album" class="mini_player_album">{{ state.album }}</span>
        </span>

        <span
          v-if="isExpanded && state !== null && state.year !== null"
          class="mini_player_year"
          data-testid="mini-year"
        >
          {{ state?.year }}
        </span>

        <div v-if="!isExpanded && !isVertical" class="mini_player_controls">
          <template v-if="state !== null">
            <button
              class="mini_player_button"
              type="button"
              :aria-label="t('player.previous')"
              :disabled="!state?.hasPrevious"
              data-testid="mini-previous"
              @click="runMiniCommand('previous')"
            >
              <AppIcon name="previous" />
            </button>
            <button
              class="mini_player_button mini_player_button_main"
              type="button"
              :aria-label="state?.isPlaying ? t('player.pause') : t('player.play')"
              :disabled="state === null"
              data-testid="mini-toggle"
              @click="runMiniCommand('toggle')"
            >
              <AppIcon :name="state?.isPlaying ? 'pause' : 'play'" />
            </button>
            <button
              class="mini_player_button"
              type="button"
              :aria-label="t('player.next')"
              :disabled="!state?.hasNext"
              data-testid="mini-next"
              @click="runMiniCommand('next')"
            >
              <AppIcon name="next" />
            </button>
          </template>
          <template v-else>
            <AppSkeleton
              v-for="(size, index) in controlPlaceholders"
              :key="index"
              variant="circle"
              :width="size"
              :height="size"
            />
          </template>
        </div>
      </div>

      <!-- Expanded: transport left and volume right above the progress bar. Compact: the
           volume stays beside the progress bar because the transport is already above it. -->
      <div
        class="mini_player_progress_area"
        :class="{
          mini_player_progress_area_compact: !isExpanded,
          mini_player_progress_area_expanded: isExpanded,
        }"
      >
        <div v-if="isExpanded || isVertical" class="mini_player_playback_row">
          <div class="mini_player_controls">
            <template v-if="state !== null">
              <button
                class="mini_player_button"
                type="button"
                :aria-label="t('player.previous')"
                :disabled="!state?.hasPrevious"
                data-testid="mini-previous"
                @click="runMiniCommand('previous')"
              >
                <AppIcon name="previous" />
              </button>
              <button
                class="mini_player_button mini_player_button_main"
                type="button"
                :aria-label="state?.isPlaying ? t('player.pause') : t('player.play')"
                :disabled="state === null"
                data-testid="mini-toggle"
                @click="runMiniCommand('toggle')"
              >
                <AppIcon :name="state?.isPlaying ? 'pause' : 'play'" />
              </button>
              <button
                class="mini_player_button"
                type="button"
                :aria-label="t('player.next')"
                :disabled="!state?.hasNext"
                data-testid="mini-next"
                @click="runMiniCommand('next')"
              >
                <AppIcon name="next" />
              </button>
              <button
                v-if="isExpanded"
                class="mini_player_button"
                type="button"
                :aria-label="t('player.stop')"
                :disabled="state === null"
                data-testid="mini-stop"
                @click="runMiniCommand('stop')"
              >
                <AppIcon name="stop" />
              </button>
            </template>
            <template v-else>
              <AppSkeleton
                v-for="(size, index) in controlPlaceholders"
                :key="index"
                variant="circle"
                :width="size"
                :height="size"
              />
            </template>
          </div>

          <div v-if="!isExpanded || !isVertical" class="mini_player_sound">
            <button
              class="mini_player_button"
              type="button"
              :aria-label="state?.isMuted ? t('player.unmute') : t('player.mute')"
              :aria-pressed="state?.isMuted ?? false"
              :disabled="state === null"
              data-testid="mini-mute"
              @click="runMiniCommand('mute')"
            >
              <AppIcon :name="state?.isMuted ? 'mute' : 'volume'" />
            </button>
            <PlayerVolume
              class="mini_player_volume"
              :model-value="state?.volume ?? 0"
              :disabled="state === null"
              @update:model-value="runMiniCommand('volume', $event)"
            />
          </div>
        </div>

        <!-- The bar and its times keep their room from the first frame: the dock is a fixed
             size, and a line that turns up afterwards moves everything under it. -->
        <div
          v-if="settings.miniPlayerProgress !== 'none' && state === null"
          class="mini_player_progress mini_player_progress_placeholder"
          aria-hidden="true"
        >
          <AppSkeleton
            v-if="settings.miniPlayerProgress !== 'line'"
            class="mini_player_time_placeholder"
          />
          <AppSkeleton class="mini_player_bar_placeholder" variant="box" height="0.35rem" />
          <AppSkeleton
            v-if="settings.miniPlayerProgress !== 'line'"
            class="mini_player_time_placeholder"
          />
        </div>

        <PlayerProgress
          v-else-if="settings.miniPlayerProgress !== 'none'"
          class="mini_player_progress"
          :class="{
            mini_player_progress_line: settings.miniPlayerProgress === 'line',
            mini_player_progress_playing: state?.isPlaying === true,
          }"
          :position="state?.position ?? 0"
          :duration="state?.duration ?? 0"
          :hide-times="settings.miniPlayerProgress === 'line'"
          data-testid="mini-progress"
          @seek="runMiniCommand('seek', $event)"
        />

        <div
          v-if="isExpanded && isVertical"
          class="mini_player_sound mini_player_sound_vertical_bottom"
        >
          <button
            class="mini_player_button"
            type="button"
            :aria-label="state?.isMuted ? t('player.unmute') : t('player.mute')"
            :aria-pressed="state?.isMuted ?? false"
            :disabled="state === null"
            data-testid="mini-mute"
            @click="runMiniCommand('mute')"
          >
            <AppIcon :name="state?.isMuted ? 'mute' : 'volume'" />
          </button>
          <PlayerVolume
            class="mini_player_volume"
            :model-value="state?.volume ?? 0"
            :disabled="state === null"
            @update:model-value="runMiniCommand('volume', $event)"
          />
        </div>

        <div v-if="!isExpanded && !isVertical" class="mini_player_sound">
          <button
            class="mini_player_button"
            type="button"
            :aria-label="state?.isMuted ? t('player.unmute') : t('player.mute')"
            :aria-pressed="state?.isMuted ?? false"
            :disabled="state === null"
            data-testid="mini-mute"
            @click="runMiniCommand('mute')"
          >
            <AppIcon :name="state?.isMuted ? 'mute' : 'volume'" />
          </button>
          <PlayerVolume
            class="mini_player_volume"
            :model-value="state?.volume ?? 0"
            :disabled="state === null"
            @update:model-value="runMiniCommand('volume', $event)"
          />
        </div>
      </div>
    </template>

    <!-- The question stands in a window of its own, over this one: the dock is dimmed and
         holds nothing to click but the way back to it. -->
    <div
      v-if="isAsking"
      class="mini_player_veil"
      :title="t('mini.confirm.title')"
      data-testid="mini-veil"
      @click.stop="raiseQuestion"
    ></div>

    <section v-else-if="isClosing" class="mini_player_close_panel" role="dialog" aria-modal="true">
      <div class="mini_player_close_content">
        <AppIcon name="warning" />
        <strong>{{ t('mini.confirm.title') }}</strong>
        <p>{{ t('mini.confirm.message') }}</p>

        <label class="mini_player_remember">
          <input v-model="remembers" type="checkbox" data-testid="mini-remember" />
          <span>{{ t('mini.confirm.remember') }}</span>
        </label>

        <div class="mini_player_close_actions">
          <AppButton data-testid="mini-close-cancel" @click="isClosing = false">
            {{ t('mini.confirm.cancel') }}
          </AppButton>
          <AppButton data-testid="mini-close-dock" @click="close(false)">
            {{ t('mini.confirm.dockOnly') }}
          </AppButton>
          <AppButton variant="danger" data-testid="mini-close-app" @click="close(true)">
            {{ t('mini.confirm.wholeApp') }}
          </AppButton>
        </div>
      </div>
    </section>
  </div>

  <!-- The menu belongs to the window, not to the dock surface: it can float over it and over
       the confirmation dialog without being clipped by the dock layout. -->
  <Teleport to="body">
    <div
      v-if="isSheetOpen"
      class="mini_player_sheet"
      role="menu"
      data-testid="mini-sheet"
      @click="closeSheet"
    >
      <button
        class="mini_player_sheet_item"
        type="button"
        role="menuitemradio"
        :aria-checked="isVertical"
        data-testid="mini-orientation"
        @click="toggleOrientation"
      >
        <AppIcon :name="isVertical ? 'grid' : 'list'" />
        <span>{{ isVertical ? t('mini.menu.horizontal') : t('mini.menu.vertical') }}</span>
      </button>

      <hr class="mini_player_sheet_divider" />

      <button
        class="mini_player_sheet_item"
        type="button"
        role="menuitem"
        data-testid="mini-settings"
        @click="runMiniCommand('settings')"
      >
        <AppIcon name="settings" />
        <span>{{ t('mini.menu.settings') }}</span>
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.mini_player {
  display: flex;
  position: relative;
  flex-direction: column;
  gap: $space_xs;
  height: 100%;
  padding: $space_2xs $space_sm $space_sm;
  // Two lines rather than one: the dock is an undecorated window standing on whatever
  // happens to be behind it, and a single edge disappears against a surface of its own
  // value. The outer one holds the shape, the inner one keeps it there on a dark desktop.
  border: 1px solid var(--color_border_strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color_text) 10%, transparent);
  background-color: var(--color_bg);
  color: var(--color_text);

  // The colour of the cover, laid over the window background.
  &_accented {
    background-repeat: no-repeat;
    background-size: cover;
  }

  &_bar {
    display: flex;
    gap: $space_2xs;
    align-items: center;
  }

  // The empty middle of the top line is what the window is dragged by.
  &_grip {
    flex: 1;
    align-self: stretch;
  }

  &_track {
    display: flex;
    flex: 1;
    gap: $space_md;
    align-items: center;
    min-width: 0;
  }

  &_expanded &_track {
    align-items: center;
  }

  // One column, centred: the cover, then the title, the artist and the album written under
  // it, and the year last. Ellipsis over centred text needs the names left to stretch, so
  // the centring is the text's rather than the column's.
  &_vertical &_track {
    flex: 1;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    gap: $space_sm;
    text-align: center;
  }

  &_vertical &_names {
    flex: 0 1 auto;
    max-width: 100%;
  }

  &_cover {
    display: inline-flex;
    position: relative;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    overflow: hidden;
    border: 1px solid var(--color_border);
    border-radius: $radius_sm;
    background-color: var(--color_surface_alt);
    color: var(--color_text_muted);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &_vertical &_cover {
    width: 4rem;
    height: 4rem;
  }

  &_expanded &_cover {
    width: 3.25rem;
    height: 3.25rem;
  }

  &.mini_player_vertical.mini_player_expanded &_cover {
    width: 7rem;
    height: 7rem;
  }

  &_names {
    display: flex;
    flex: 1;
    flex-direction: column;
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

  &_artist {
    @include selectable_text;

    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.8em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_expanded &_title {
    font-size: 1em;
  }

  &_expanded &_artist {
    font-size: 0.8125em;
  }

  &_album {
    @include selectable_text;

    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.75em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_year {
    flex-shrink: 0;
    margin-left: auto;
    color: var(--color_text_muted);
    font-size: 0.875em;
    font-variant-numeric: tabular-nums;
  }

  // Stacked rather than beside the names, so nothing pulls the column off centre.
  &_vertical &_year {
    margin-left: 0;
  }

  &_controls {
    display: flex;
    flex-shrink: 0;
    gap: $space_xs;
    align-items: center;
    justify-content: center;
  }

  &_playback_row {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
  }

  // The volume is not the length of the track: a short slider, kept at the end of the row
  // next to the command it belongs to.
  &_sound {
    display: flex;
    flex-shrink: 0;
    gap: $space_xs;
    align-items: center;
    justify-content: flex-end;
  }

  &_progress_area {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    min-width: 0;

    &_compact {
      flex-direction: row;
      align-items: center;
    }

    &_expanded {
      gap: $space_sm;
    }
  }

  &.mini_player_vertical {
    gap: $space_sm;
    padding-bottom: $space_sm;

    .mini_player_progress_area {
      flex-shrink: 0;
      gap: $space_sm;
    }
  }

  &.mini_player_vertical.mini_player_expanded {
    padding-inline: $space_md;
  }

  &.mini_player_vertical:not(.mini_player_expanded) {
    .mini_player_button {
      width: 1.75rem;
      height: 1.75rem;
    }

    .mini_player_controls,
    .mini_player_sound {
      gap: $space_2xs;
    }

    .mini_player_volume {
      width: 4rem;
    }
  }

  &.mini_player_vertical:not(.mini_player_expanded) &_progress_area_compact {
    flex-direction: column;
    align-items: stretch;
    gap: $space_sm;
  }

  &.mini_player_vertical.mini_player_expanded &_playback_row {
    justify-content: center;
  }

  &.mini_player_expanded:not(.mini_player_vertical) &_playback_row {
    justify-content: space-around;
  }

  &_sound_vertical_bottom {
    justify-content: center;
  }

  &_volume {
    flex: 0 0 auto;
    width: 6rem;
  }

  &_progress {
    flex-shrink: 0;
  }

  // Reduced to a line, the progress is read at a glance and takes no room.
  &_progress_line {
    font-size: 0.75em;
  }

  // The bar is the one thing on its row, so it is drawn to be seen from across a desk: a
  // thicker track, and a round marker large enough to be aimed at.
  &_progress :deep(.app_slider_field) {
    height: 1.1rem;
    appearance: none;
    background: none;

    &::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(
        to right,
        var(--color_accent) var(--mini_progress, 0%),
        color-mix(in srgb, var(--color_text) 20%, transparent) var(--mini_progress, 0%)
      );
    }

    &::-webkit-slider-thumb {
      width: 0.85rem;
      height: 0.85rem;
      margin-top: -0.25rem;
      appearance: none;
      border-radius: 999px;
      background-color: var(--color_accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color_accent) 25%, transparent);
    }
  }

  // While the sound is running the marker breathes, which is what says at a glance that the
  // dock is playing rather than paused at that point.
  &_progress_playing :deep(.app_slider_field::-webkit-slider-thumb) {
    animation: mini_player_pulse 1.6s ease-in-out infinite;
  }

  // Over the face of the dock, under the top line that opened it.
  &_sheet {
    display: flex;
    position: fixed;
    top: 2.35rem;
    right: $space_2xs;
    width: min(16rem, calc(100% - #{$space_sm}));
    max-height: calc(100% - 2.75rem);
    z-index: 50;
    flex-direction: column;
    gap: $space_2xs;
    padding: $space_xs;
    @include surface_panel($radius_md);
    box-shadow: var(--shadow_raised);

    @include scroll_area;

    &_item {
      display: flex;
      flex-shrink: 0;
      gap: $space_sm;
      align-items: center;
      min-height: 1.9rem;
      padding: 0 $space_sm;
      border: 0;
      border-radius: $radius_sm;
      background: none;
      color: var(--color_text);
      font: inherit;
      font-size: 0.8125em;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;

      &:hover:not(:disabled) {
        background-color: var(--color_surface_hover);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &[aria-checked='true'] {
        color: var(--color_accent);
      }

      @include focus_ring;
    }

    &_divider {
      flex-shrink: 0;
      height: 1px;
      margin: $space_2xs 0;
      border: 0;
      background-color: var(--color_border);
    }
  }

  &_button {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 1.9rem;
    height: 1.9rem;
    border: 0;
    border-radius: 999px;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 0.8em;
    cursor: pointer;

    &:disabled {
      opacity: 0.35;
      cursor: wait;
    }

    &:hover:not(:disabled) {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    @include focus_ring;

    &_main {
      width: 2.4rem;
      height: 2.4rem;
      background-color: var(--color_accent);
      color: var(--color_on_accent);

      &:hover:not(:disabled) {
        background-color: var(--color_accent_hover);
        color: var(--color_on_accent);
      }
    }

    &_active {
      background-color: color-mix(in srgb, var(--color_accent) 18%, transparent);
      color: var(--color_accent);

      &:hover:not(:disabled) {
        background-color: color-mix(in srgb, var(--color_accent) 28%, transparent);
        color: var(--color_accent);
      }
    }
  }

  &_skeleton_title {
    width: min(12rem, 80%);
  }

  &_skeleton_artist {
    width: min(8rem, 55%);
    margin-top: $space_2xs;
  }

  // The same line the bar and its two times take, so nothing shifts once they arrive.
  &_progress_placeholder {
    display: flex;
    gap: $space_sm;
    align-items: center;
  }

  &_time_placeholder {
    width: 1.75rem;
  }

  &_bar_placeholder {
    flex: 1;
  }

  // Dimmed rather than hidden: the dock is still what the question is about, and it is
  // plainly out of reach for as long as the question stands.
  &_veil {
    position: absolute;
    inset: 0;
    z-index: 40;
    backdrop-filter: blur(1px);
    background-color: color-mix(in srgb, var(--color_bg) 62%, transparent);
    cursor: pointer;
  }

  &_remember {
    display: flex;
    gap: $space_sm;
    align-items: center;
    margin-top: $space_md;
    cursor: pointer;

    input {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color_accent);
    }
  }

  &_close_panel {
    display: flex;
    position: fixed;
    flex: 1;
    inset: 0;
    z-index: 100;
    align-items: center;
    justify-content: center;
    min-height: 0;
    overflow: auto;
    padding: $space_sm;
    background-color: var(--color_bg);
    text-align: center;
  }

  &_close_content {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    align-items: center;
    width: min(30rem, 100%);

    :deep(.app_icon) {
      color: var(--color_accent);
      font-size: 1.35rem;
    }

    strong {
      font-size: 1em;
    }

    p {
      max-width: 30rem;
      margin: 0;
      color: var(--color_text_muted);
      font-size: 0.84em;
      line-height: 1.35;
    }
  }

  &_close_actions {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    align-items: stretch;
    width: min(16rem, 100%);
    margin-top: $space_2xs;

    :deep(button) {
      width: 100%;
    }
  }
}

@keyframes mini_player_pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color_accent) 25%, transparent);
  }

  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--color_accent) 12%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mini_player_progress_playing :deep(.app_slider_field::-webkit-slider-thumb) {
    animation: none;
  }

  .mini_player_skeleton {
    animation: none;
  }
}
</style>
