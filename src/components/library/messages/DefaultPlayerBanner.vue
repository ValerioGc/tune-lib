<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppTooltip from '@/components/common/controls/AppTooltip.vue';
import { isDefaultAudioPlayer, openDefaultAudioPlayerSettings } from '@/services/default-player';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
const isOpening = ref(false);
const failed = ref(false);
const showBanner = ref(false);
let latestCheck = 0;

async function refreshAssociation() {
  const check = ++latestCheck;
  const isDefault = await isDefaultAudioPlayer();
  if (check === latestCheck) {
    showBanner.value = isDefault !== true;
  }
}

onMounted(() => {
  void refreshAssociation();
  window.addEventListener('focus', refreshAssociation);
});

onBeforeUnmount(() => {
  latestCheck += 1;
  window.removeEventListener('focus', refreshAssociation);
});

async function openSettings() {
  isOpening.value = true;
  failed.value = false;

  const opened = await openDefaultAudioPlayerSettings();
  failed.value = !opened;
  isOpening.value = false;
}

async function dismiss() {
  await settings.dismissDefaultPlayerBanner();
}
</script>

<template>
  <section
    v-if="showBanner"
    class="default_player_banner"
    :aria-label="t('library.defaultPlayerBanner.title')"
  >
    <div class="default_player_banner_content">
      <strong>{{ t('library.defaultPlayerBanner.title') }}</strong>
      <span>{{ t('library.defaultPlayerBanner.message') }}</span>
      <span v-if="failed" class="default_player_banner_error">
        {{ t('settings.defaultPlayer.error') }}
      </span>
    </div>

    <div class="default_player_banner_actions">
      <AppButton variant="primary" :disabled="isOpening" @click="openSettings">
        {{
          isOpening ? t('settings.defaultPlayer.opening') : t('library.defaultPlayerBanner.action')
        }}
      </AppButton>
      <AppTooltip :text="t('library.defaultPlayerBanner.dismiss')">
        <AppButton
          variant="ghost"
          class="default_player_banner_close"
          :aria-label="t('library.defaultPlayerBanner.dismiss')"
          @click="dismiss"
        >
          <AppIcon name="close" />
        </AppButton>
      </AppTooltip>
    </div>
  </section>
</template>

<style scoped lang="scss">
.default_player_banner {
  display: flex;
  gap: $space_md;
  align-items: center;
  justify-content: space-between;
  padding: $space_md;
  border: 1px solid var(--color_border_strong);
  border-radius: $radius_md;
  background-color: var(--color_surface_alt);

  &_content {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    min-width: 0;
    color: var(--color_text_muted);

    strong {
      color: var(--color_text);
    }
  }

  &_error {
    color: var(--color_text);
  }

  &_actions {
    display: flex;
    flex: 0 0 auto;
    gap: $space_sm;
    align-items: center;
  }

  &_close {
    min-width: 2.25rem;
  }

  @media (max-width: 720px) {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
