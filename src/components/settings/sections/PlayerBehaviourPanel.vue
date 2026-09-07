<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppSelect from '@/components/common/input/AppSelect.vue';
import { useSettingsStore } from '@/stores/settings';
import {
  DOCK_CLOSE_ACTIONS,
  DOCK_LEVELS,
  DOCK_ORIENTATIONS,
  DOCK_PROGRESS_STYLES,
  type DockCloseAction,
  type DockLevel,
  type DockOrientation,
  type DockProgressStyle,
} from '@/types/settings';

const { t } = useI18n();
const settings = useSettingsStore();

const orientationOptions = computed(() =>
  DOCK_ORIENTATIONS.map((orientation) => ({
    value: orientation,
    label: t(`settings.playerBehaviour.orientations.${orientation}`),
  })),
);

const levelOptions = computed(() =>
  DOCK_LEVELS.map((level) => ({
    value: level,
    label: t(`settings.playerBehaviour.levels.${level}`),
  })),
);

const progressOptions = computed(() =>
  DOCK_PROGRESS_STYLES.map((style) => ({
    value: style,
    label: t(`settings.playerBehaviour.progressStyles.${style}`),
  })),
);

const closeOptions = computed(() =>
  DOCK_CLOSE_ACTIONS.map((action) => ({
    value: action,
    label: t(`settings.playerBehaviour.closeActions.${action}`),
  })),
);

async function onKeepOpenChange(event: Event) {
  await settings.setKeepPlayerOpen((event.target as HTMLInputElement).checked);
}

async function onDockChange(event: Event) {
  await settings.setMiniPlayerEnabled((event.target as HTMLInputElement).checked);
}

async function onOrientationChange(value: string) {
  await settings.setMiniPlayerOrientation(value as DockOrientation);
}

async function onLevelChange(value: string) {
  await settings.setMiniPlayerLevel(value as DockLevel);
}

async function onRemembersLevelChange(event: Event) {
  await settings.setMiniPlayerRemembersLevel((event.target as HTMLInputElement).checked);
}

async function onProgressChange(value: string) {
  await settings.setMiniPlayerProgress(value as DockProgressStyle);
}

async function onGradientChange(event: Event) {
  await settings.setMiniPlayerGradient((event.target as HTMLInputElement).checked);
}

async function onCloseActionChange(value: string) {
  await settings.setMiniPlayerCloseAction(value as DockCloseAction);
}
</script>

<template>
  <div class="player_behaviour_panel">
    <label class="player_behaviour_panel_check common_check">
      <input
        type="checkbox"
        :checked="settings.keepPlayerOpen"
        data-testid="keep-player-open-toggle"
        @change="onKeepOpenChange"
      />
      <span>{{ t('settings.playerBehaviour.keepOpen') }}</span>
    </label>

    <label class="player_behaviour_panel_check common_check">
      <input
        type="checkbox"
        :checked="settings.miniPlayerEnabled"
        data-testid="mini-player-toggle"
        @change="onDockChange"
      />
      <span>{{ t('settings.playerBehaviour.dock') }}</span>
    </label>

    <template v-if="settings.miniPlayerEnabled">
      <AppSelect
        class="player_behaviour_panel_select"
        :model-value="settings.miniPlayerOrientation"
        :options="orientationOptions"
        :label="t('settings.playerBehaviour.orientation')"
        data-testid="mini-player-orientation"
        @update:model-value="onOrientationChange"
      />

      <label class="player_behaviour_panel_check player_behaviour_panel_check_nested common_check">
        <input
          type="checkbox"
          :checked="settings.miniPlayerGradient"
          data-testid="mini-player-gradient-toggle"
          @change="onGradientChange"
        />
        <span>{{ t('settings.playerBehaviour.gradient') }}</span>
      </label>

      <AppSelect
        class="player_behaviour_panel_select"
        :model-value="settings.miniPlayerLevel"
        :options="levelOptions"
        :label="t('settings.playerBehaviour.level')"
        data-testid="mini-player-level"
        @update:model-value="onLevelChange"
      />

      <label class="player_behaviour_panel_check player_behaviour_panel_check_nested common_check">
        <input
          type="checkbox"
          :checked="settings.miniPlayerRemembersLevel"
          data-testid="mini-player-remembers-level"
          @change="onRemembersLevelChange"
        />
        <span>{{ t('settings.playerBehaviour.remembersLevel') }}</span>
      </label>

      <AppSelect
        class="player_behaviour_panel_select"
        :model-value="settings.miniPlayerProgress"
        :options="progressOptions"
        :label="t('settings.playerBehaviour.progress')"
        data-testid="mini-player-progress"
        @update:model-value="onProgressChange"
      />

      <AppSelect
        class="player_behaviour_panel_select"
        :model-value="settings.miniPlayerCloseAction"
        :options="closeOptions"
        :label="t('settings.playerBehaviour.closeAction')"
        data-testid="mini-player-close-action"
        @update:model-value="onCloseActionChange"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.player_behaviour_panel {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  align-items: flex-start;

  &_check {
    // A line that depends on the one above it reads as its detail.
    &_nested {
      margin-left: $space_lg;
    }
  }

  &_select {
    margin-left: $space_lg;
  }
}
</style>
