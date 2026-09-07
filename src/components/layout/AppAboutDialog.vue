<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import appLogo from '@/assets/logo.svg';
import type { IconName } from '@/config/icons';
import { APP_NAME, APP_VERSION, CHANGELOG_URL, GITHUB_URL, WEBSITE_URL } from '@/config/app-config';
import { openExternal } from '@/services/external-link';

defineProps<{ open: boolean }>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const links = computed<{ id: string; label: string; icon: IconName; url: string }[]>(() => [
  { id: 'website', label: t('about.website'), icon: 'external', url: WEBSITE_URL },
  { id: 'repository', label: t('about.repository'), icon: 'external', url: GITHUB_URL },
  { id: 'changelog', label: t('about.changelog'), icon: 'list', url: CHANGELOG_URL },
]);

async function openLink(url: string) {
  await openExternal(url);
}
</script>

<template>
  <AppModal :open="open" :title="t('about.title')" @close="emit('close')">
    <div class="app_about">
      <p class="app_about_name">
        <img class="app_about_logo" :src="appLogo" alt="" width="44" height="44" />
        <span>{{ APP_NAME }}</span>
        <span class="app_about_version">{{ APP_VERSION }}</span>
      </p>

      <p class="app_about_description">{{ t('about.description') }}</p>

      <ul class="app_about_links">
        <li v-for="link in links" :key="link.id">
          <button
            class="app_about_link"
            type="button"
            :data-testid="`about-${link.id}`"
            @click="openLink(link.url)"
          >
            <AppIcon :name="link.icon" />
            <span>{{ link.label }}</span>
          </button>
        </li>
      </ul>
    </div>

    <template #actions>
      <AppButton variant="primary" @click="emit('close')">{{ t('about.close') }}</AppButton>
    </template>
  </AppModal>
</template>

<style scoped lang="scss">
.app_about {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_logo {
    flex-shrink: 0;
    align-self: center;
  }

  &_name {
    display: flex;
    gap: $space_sm;
    align-items: center;
    color: var(--color_text);
    font-size: 1.125em;
    font-weight: 600;
  }

  &_version {
    @include selectable_text;

    color: var(--color_text_muted);
    font-size: 0.8125em;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }

  &_description {
    color: var(--color_text_muted);
  }

  &_links {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    margin: 0;
    padding-left: 0;
    list-style: none;
  }

  &_link {
    display: flex;
    gap: $space_sm;
    align-items: center;
    width: 100%;
    min-height: 2.25rem;
    padding: $space_xs $space_sm;
    border: 0;
    border-radius: $radius_sm;
    background: none;
    color: var(--color_accent);
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background-color: var(--color_surface_hover);
      text-decoration: underline;
    }

    @include focus_ring;
  }
}
</style>
