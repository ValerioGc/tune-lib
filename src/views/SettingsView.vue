<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BackToLibrary from '@/components/layout/BackToLibrary.vue';
import AccentColorPicker from '@/components/settings/sections/AccentColorPicker.vue';
import AmbienceToggle from '@/components/settings/sections/AmbienceToggle.vue';
import BannerDurationSelect from '@/components/settings/sections/BannerDurationSelect.vue';
import CoverCachePanel from '@/components/settings/sections/CoverCachePanel.vue';
import CoverGradientToggle from '@/components/settings/sections/CoverGradientToggle.vue';
import DefaultPlayerPanel from '@/components/settings/sections/DefaultPlayerPanel.vue';
import ImportExportPanel from '@/components/settings/sections/ImportExportPanel.vue';
import LanguageSelect from '@/components/settings/sections/LanguageSelect.vue';
import LibraryCreateForm from '@/components/settings/sections/LibraryCreateForm.vue';
import LibraryList from '@/components/settings/sections/LibraryList.vue';
import PlayerBehaviourPanel from '@/components/settings/sections/PlayerBehaviourPanel.vue';
import SettingsSection from '@/components/settings/layout/SettingsSection.vue';
import SettingsTabs from '@/components/settings/layout/SettingsTabs.vue';
import StartupPanel from '@/components/settings/sections/StartupPanel.vue';
import TextSizeSelect from '@/components/settings/sections/TextSizeSelect.vue';
import ThemeSwitch from '@/components/settings/sections/ThemeSwitch.vue';
import { useLibraryStore } from '@/stores/library';
import { useNavigationStore } from '@/stores/navigation';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const library = useLibraryStore();
const navigation = useNavigationStore();
const settings = useSettingsStore();

const tabs = computed(() => [
  { id: 'general', label: t('settings.tabs.general') },
  { id: 'appearance', label: t('settings.tabs.appearance') },
  { id: 'library', label: t('settings.tabs.library') },
]);

watch(
  () => [navigation.isSettings, navigation.settingsFocus] as const,
  async ([isSettings, focus]) => {
    if (!isSettings || focus !== 'player') {
      return;
    }

    await nextTick();
    document
      .querySelector<HTMLElement>('[data-testid="settings-player-section"]')
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    navigation.clearSettingsFocus();
  },
  { immediate: true },
);

async function setTableDividers(event: Event) {
  await settings.setTableColumnDividers((event.target as HTMLInputElement).checked);
}
</script>

<template>
  <!-- A library import runs to the end before anything else is answered: leaving the page,
       switching tab or starting a second command in the middle of it would each act on a
       library that is being rewritten. The fieldset takes every control down at once, and
       the import panel says why. -->
  <fieldset
    class="settings_view"
    :disabled="library.isLibraryImporting"
    :aria-busy="library.isLibraryImporting"
    data-testid="settings-page"
  >
    <BackToLibrary />

    <header class="settings_view_header">
      <h1 class="settings_view_title">{{ t('settings.title') }}</h1>
      <p class="settings_view_subtitle">{{ t('settings.subtitle') }}</p>
    </header>

    <SettingsTabs :tabs="tabs">
      <template #library>
        <div class="settings_view_group">
          <SettingsSection
            :title="t('settings.importExport.title')"
            :description="t('settings.importExport.description')"
          >
            <ImportExportPanel />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.libraries.title')"
            :description="t('settings.libraries.description')"
          >
            <LibraryCreateForm />
            <LibraryList />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.coverCache.title')"
            :description="t('settings.coverCache.description')"
          >
            <CoverCachePanel />
          </SettingsSection>
        </div>
      </template>
      <template #general>
        <div class="settings_view_group">
          <SettingsSection
            :title="t('settings.language.title')"
            :description="t('settings.language.description')"
          >
            <LanguageSelect />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.startup.title')"
            :description="t('settings.startup.description')"
          >
            <StartupPanel />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.playerBehaviour.title')"
            :description="t('settings.playerBehaviour.description')"
            data-testid="settings-player-section"
          >
            <PlayerBehaviourPanel />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.banners.title')"
            :description="t('settings.banners.description')"
          >
            <BannerDurationSelect />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.defaultPlayer.title')"
            :description="t('settings.defaultPlayer.description')"
          >
            <DefaultPlayerPanel />
          </SettingsSection>
        </div>
      </template>

      <template #appearance>
        <div class="settings_view_group">
          <div class="settings_view_divider">
            <span>{{ t('settings.appearance.application') }}</span>
          </div>

          <SettingsSection
            :title="t('settings.textSize.title')"
            :description="t('settings.textSize.description')"
          >
            <TextSizeSelect />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.theme.title')"
            :description="t('settings.theme.description')"
          >
            <ThemeSwitch />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.accent.title')"
            :description="t('settings.accent.description')"
          >
            <AccentColorPicker />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.ambience.title')"
            :description="t('settings.ambience.description')"
          >
            <AmbienceToggle />
          </SettingsSection>

          <SettingsSection
            :title="t('settings.appearance.library')"
            :description="t('library.columnSettings.dividersHint')"
          >
            <label class="settings_view_check common_check">
              <input
                type="checkbox"
                :checked="settings.tableColumnDividers"
                data-testid="settings-column-dividers"
                @change="setTableDividers"
              />
              <span>{{ t('library.columnSettings.dividers') }}</span>
            </label>
          </SettingsSection>

          <div class="settings_view_divider">
            <span>{{ t('settings.appearance.player') }}</span>
          </div>

          <SettingsSection
            :title="t('settings.coverGradient.title')"
            :description="t('settings.coverGradient.description')"
          >
            <CoverGradientToggle />
          </SettingsSection>
        </div>
      </template>
    </SettingsTabs>
  </fieldset>
</template>

<style scoped lang="scss">
// The page takes the whole window and the content lines up in a column inside it.
//
// The other way round — a narrow page holding the scrolling box — put the scrollbar against
// the sections and left the wheel doing nothing over the empty space beside them, which is
// most of the window on a wide screen.
.settings_view {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space_lg;
  width: 100%;
  min-height: 0;
  // A fieldset carries a border, a margin and a minimum width of its own, none of which
  // belong to a page.
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
  --settings_column: 54rem;

  &_header {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    text-align: center;

    @include page_column(var(--settings_column));
  }

  &_title {
    font-size: 1.75em;
    font-weight: 600;
  }

  &_subtitle {
    color: var(--color_text_muted);
  }

  &_group {
    display: flex;
    flex-direction: column;
    gap: $space_lg;

    @include page_column(var(--settings_column));
  }

  &_divider {
    display: flex;
    gap: $space_md;
    align-items: center;
    color: var(--color_text_muted);
    font-size: 0.8em;
    font-weight: 700;
    text-transform: uppercase;

    &::after {
      flex: 1;
      height: 1px;
      background-color: var(--color_border);
      content: '';
    }
  }
}
</style>
