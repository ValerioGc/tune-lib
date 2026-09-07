<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();

/** Starting out of sight only means something once the app starts on its own. */
const isMinimizedDisabled = computed(() => !settings.autostartEnabled);

async function onAutostartChange(event: Event) {
  await settings.setAutostartEnabled((event.target as HTMLInputElement).checked);
}

async function onMinimizedChange(event: Event) {
  await settings.setAutostartMinimized((event.target as HTMLInputElement).checked);
}

async function onCloseToTrayChange(event: Event) {
  await settings.setCloseToTray((event.target as HTMLInputElement).checked);
}
</script>

<template>
  <div class="startup_panel">
    <label class="startup_panel_check common_check">
      <input
        type="checkbox"
        :checked="settings.autostartEnabled"
        data-testid="autostart-toggle"
        @change="onAutostartChange"
      />
      <span>{{ t('settings.startup.autostart') }}</span>
    </label>

    <label
      class="startup_panel_check startup_panel_check_nested common_check"
      :class="{ startup_panel_check_disabled: isMinimizedDisabled }"
    >
      <input
        type="checkbox"
        :checked="settings.autostartMinimized"
        :disabled="isMinimizedDisabled"
        data-testid="autostart-minimized-toggle"
        @change="onMinimizedChange"
      />
      <span>{{ t('settings.startup.minimized') }}</span>
    </label>

    <label class="startup_panel_check common_check">
      <input
        type="checkbox"
        :checked="settings.closeToTray"
        data-testid="close-to-tray-toggle"
        @change="onCloseToTrayChange"
      />
      <span>{{ t('settings.startup.closeToTray') }}</span>
    </label>

    <p class="startup_panel_hint">{{ t('settings.startup.hint') }}</p>
  </div>
</template>

<style scoped lang="scss">
.startup_panel {
  display: flex;
  flex-direction: column;
  gap: $space_sm;

  &_check {
    // The second line depends on the first: it reads as a detail of it, not as a peer.
    &_nested {
      margin-left: $space_lg;
    }

    &_disabled {
      color: var(--color_text_muted);
      cursor: not-allowed;
    }
  }

  &_hint {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }
}
</style>
