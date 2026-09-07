<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import { formatBytes } from '@/services/file-size';
import { clearCoverCache, coverCacheSize } from '@/services/library-api';
import type { CoverCacheReport } from '@/types/library';

const { t, locale } = useI18n();

const report = ref<CoverCacheReport>({ bytes: 0, limitBytes: 0 });
const isClearing = ref(false);
const isConfirming = ref(false);
const status = ref<'cleared' | 'failed' | null>(null);

const isEmpty = computed(() => report.value.bytes === 0);
const size = computed(() => formatBytes(report.value.bytes, locale.value));
const limit = computed(() => formatBytes(report.value.limitBytes, locale.value));

/** A cache that cannot be measured is reported as empty: there is nothing to offer. */
async function readSize() {
  try {
    report.value = await coverCacheSize();
  } catch {
    report.value = { bytes: 0, limitBytes: 0 };
  }
}

async function clear() {
  isConfirming.value = false;
  isClearing.value = true;
  status.value = null;

  try {
    report.value = await clearCoverCache();
    status.value = 'cleared';
  } catch {
    await readSize();
    status.value = 'failed';
  } finally {
    isClearing.value = false;
  }
}

onMounted(readSize);
</script>

<template>
  <div class="cover_cache_panel">
    <!-- The line is always there, empty until there is something to say: an answer that
         appeared under the button would push the rest of the page down as it arrived. -->
    <output
      class="cover_cache_panel_status"
      :class="{
        cover_cache_panel_status_on: status !== null,
        cover_cache_panel_status_failed: status === 'failed',
      }"
      data-testid="cover-cache-status"
    >
      <template v-if="status !== null">
        <AppIcon :name="status === 'cleared' ? 'check' : 'warning'" />
        {{ t(`settings.coverCache.${status}`) }}
      </template>
    </output>

    <div class="cover_cache_panel_row">
      <div class="cover_cache_panel_reading">
        <p class="cover_cache_panel_size" data-testid="cover-cache-size">
          {{ isEmpty ? t('settings.coverCache.empty') : t('settings.coverCache.size', { size }) }}
        </p>
        <p v-if="report.limitBytes > 0" class="cover_cache_panel_hint">
          {{ t('settings.coverCache.limit', { limit }) }}
        </p>
      </div>

      <AppButton
        class="cover_cache_panel_clear"
        variant="danger"
        :disabled="isClearing || isEmpty"
        data-testid="clear-cover-cache"
        @click="isConfirming = true"
      >
        <AppIcon name="remove" />
        {{ isClearing ? t('settings.coverCache.clearing') : t('settings.coverCache.clear') }}
      </AppButton>
    </div>

    <!-- Nothing of the user's is lost here, but the cache is rebuilt one cover at a time on
         a large library: worth asking once rather than emptying it on a stray click. -->
    <AppModal
      :open="isConfirming"
      :title="t('settings.coverCache.confirm.title')"
      @close="isConfirming = false"
    >
      <p>{{ t('settings.coverCache.confirm.message') }}</p>

      <template #actions>
        <AppButton data-testid="cancel-clear-cover-cache" @click="isConfirming = false">
          {{ t('settings.coverCache.confirm.cancel') }}
        </AppButton>
        <AppButton variant="danger" data-testid="confirm-clear-cover-cache" @click="clear">
          {{ t('settings.coverCache.confirm.confirm') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped lang="scss">
.cover_cache_panel {
  display: flex;
  flex-direction: column;
  gap: $space_sm;

  &_row {
    display: flex;
    gap: $space_md;
    align-items: center;
    justify-content: space-between;
  }

  &_reading {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    min-width: 0;
  }

  &_size {
    font-variant-numeric: tabular-nums;
  }

  &_hint {
    color: var(--color_text_muted);
    font-size: 0.875em;
  }

  // Room held whether or not anything is written in it, so the answer lands without moving
  // the section under it.
  &_status {
    display: flex;
    gap: $space_sm;
    align-items: center;
    min-height: 2.25rem;
    padding: 0 $space_md;
    border: 1px solid transparent;
    border-radius: $radius_md;
    font-size: 0.875em;

    &_on {
      border-color: var(--color_accent);
      background-color: var(--color_accent_soft);
      color: var(--color_text);
    }

    &_failed {
      border-color: var(--color_danger_border);
      background-color: var(--color_danger_soft);
      color: var(--color_danger);
    }
  }

  &_clear {
    flex-shrink: 0;
  }
}
</style>
