<script setup lang="ts">
import { I18nT, useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';

defineProps<{ path: string }>();

const { t } = useI18n();
</script>

<template>
  <I18nT :keypath="path" tag="span" scope="global" class="help_text">
    <template #settings>
      <strong>{{ t('settings.title') }} <AppIcon name="settings" /></strong>
    </template>
    <template #gesture
      ><strong>{{ t('help.playGesture') }}</strong></template
    >
    <template #play
      ><strong>{{ t('player.play') }} <AppIcon name="play" /></strong
    ></template>
    <template #pause
      ><strong>{{ t('player.pause') }} <AppIcon name="pause" /></strong
    ></template>
    <template #addFiles
      ><strong>{{ t('library.toolbar.add') }} <AppIcon name="add" /></strong
    ></template>
    <template #addFolder
      ><strong>{{ t('library.toolbar.addFolder') }} <AppIcon name="add" /></strong
    ></template>
    <template #save
      ><strong>{{ t('metadata.save') }}</strong></template
    >
    <template #ctrl
      ><kbd>{{ t('help.keys.ctrl') }}</kbd></template
    >
    <template #shift
      ><kbd>{{ t('help.keys.shift') }}</kbd></template
    >
    <template #esc
      ><kbd>{{ t('help.keys.esc') }}</kbd></template
    >
  </I18nT>
</template>

<style scoped lang="scss">
.help_text {
  strong {
    color: var(--color_text);
    font-weight: 600;
  }

  :deep(.app_icon) {
    color: var(--color_accent);
    vertical-align: baseline;
  }

  kbd {
    padding: $space_2xs $space_xs;
    border: 1px solid var(--color_border);
    border-radius: $radius_sm;
    background-color: var(--color_surface_hover);
    color: var(--color_text);
    font: inherit;
    font-size: 0.875em;
    white-space: nowrap;
  }
}
</style>
