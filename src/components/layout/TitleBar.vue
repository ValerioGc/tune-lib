<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import { APP_NAME } from '@/config/app-config';
import type { IconName } from '@/config/icons';
import {
  closeWindow,
  hideWindow,
  minimizeWindow,
  toggleMaximizeWindow,
} from '@/services/window-controls';
import { useNavigationStore } from '@/stores/navigation';
import { openMiniPlayer } from '@/services/shell-integration';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';

const AppAboutDialog = defineAsyncComponent(() => import('@/components/layout/AppAboutDialog.vue'));

const { t } = useI18n();
const navigation = useNavigationStore();
const player = usePlayerStore();
const settings = useSettingsStore();

async function sendToTray(): Promise<boolean> {
  navigation.go('library');

  if (settings.miniPlayerEnabled && player.isActive) {
    await openMiniPlayer(
      settings.miniPlayerOrientation === 'vertical',
      settings.miniPlayerAlwaysOnTop,
      settings.miniPlayerLevel === 'expanded',
      settings.miniPlayerPosition,
    );
  }

  return hideWindow();
}

const isAboutOpen = ref(false);

interface WindowControl {
  id: string;
  icon: IconName;
  label: string;
  action: () => Promise<boolean>;
}

const controls = computed<WindowControl[]>(() => [
  {
    id: 'tray',
    icon: 'tray',
    label: t('titlebar.tray'),
    action: () => sendToTray(),
  },
  {
    id: 'minimize',
    icon: 'minimize',
    label: t('titlebar.minimize'),
    action: () => minimizeWindow(),
  },
  {
    id: 'maximize',
    icon: 'maximize',
    label: t('titlebar.maximize'),
    action: () => toggleMaximizeWindow(),
  },
  {
    id: 'close',
    icon: 'close',
    label: t('titlebar.close'),
    action: () => (settings.closeToTray ? sendToTray() : closeWindow()),
  },
]);
</script>

<template>
  <header class="titlebar">
    <div class="titlebar_drag" data-tauri-drag-region @dblclick="toggleMaximizeWindow()">
      <AppIcon class="titlebar_mark" name="note" />
      <span class="titlebar_name">{{ APP_NAME }}</span>
    </div>

    <div class="titlebar_actions">
      <AppTooltip :text="t('nav.help')" placement="bottom" align="center">
        <button
          class="titlebar_action"
          :class="{ titlebar_action_active: navigation.isHelp }"
          type="button"
          :aria-label="t('nav.help')"
          :aria-current="navigation.isHelp ? 'page' : undefined"
          data-testid="open-help"
          @click="navigation.toggleHelp()"
        >
          <AppIcon name="help" />
        </button>
      </AppTooltip>

      <AppTooltip :text="t('nav.about')" placement="bottom" align="center">
        <button
          class="titlebar_action"
          :class="{ titlebar_action_active: isAboutOpen }"
          type="button"
          :aria-label="t('nav.about')"
          data-testid="open-about"
          @click="isAboutOpen = true"
        >
          <AppIcon name="info" />
        </button>
      </AppTooltip>

      <AppTooltip :text="t('nav.settings')" placement="bottom" align="center">
        <button
          class="titlebar_action"
          :class="{ titlebar_action_active: navigation.isSettings }"
          type="button"
          :aria-label="t('nav.settings')"
          :aria-current="navigation.isSettings ? 'page' : undefined"
          data-testid="open-settings"
          @click="navigation.toggleSettings()"
        >
          <AppIcon name="settings" />
        </button>
      </AppTooltip>
    </div>

    <AppAboutDialog v-if="isAboutOpen" :open="isAboutOpen" @close="isAboutOpen = false" />

    <div class="titlebar_controls">
      <AppTooltip
        v-for="control in controls"
        :key="control.id"
        :text="control.label"
        placement="bottom"
      >
        <button
          class="titlebar_button"
          :class="{
            titlebar_button_tray: control.id === 'tray',
            titlebar_button_minimize: control.id === 'minimize',
            titlebar_button_maximize: control.id === 'maximize',
            titlebar_button_close: control.id === 'close',
          }"
          type="button"
          :aria-label="control.label"
          :data-testid="`window-${control.id}`"
          @click="control.action"
        >
          <AppIcon :name="control.icon" />
        </button>
      </AppTooltip>
    </div>
  </header>
</template>

<style scoped lang="scss">
.titlebar {
  display: flex;
  position: relative;
  z-index: 10;
  flex-shrink: 0;
  gap: $space_sm;
  align-items: stretch;
  height: $titlebar_height;

  background-color: transparent;
  user-select: none;

  &_drag {
    display: flex;
    flex: 1;
    gap: $space_sm;
    align-items: center;
    min-width: 0;
    padding: 0 $page_gutter;
  }

  &_mark {
    color: var(--color_accent);
    font-size: 1.05rem;
  }

  &_name {
    overflow: hidden;
    color: var(--color_text_muted);
    font-size: 0.8125rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &_actions {
    display: flex;
    gap: $space_xs;
    align-items: center;
    padding-right: $space_sm;
  }

  &_controls {
    display: flex;
    align-items: stretch;
  }

  &_action,
  &_button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
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

  &_action {
    width: 2.25rem;
    height: 2.25rem;
    align-self: center;
    border-radius: $radius_md;
    font-size: 1.25rem;

    &_active {
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
    }
  }

  &_button {
    width: 2.75rem;
    height: 100%;

    &_close:hover {
      background-color: #c42b1c;
      color: #ffffff;
    }
  }
}
</style>
