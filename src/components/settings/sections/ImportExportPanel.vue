<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppSelect from '@/components/common/input/AppSelect.vue';
import { useLibraryStore } from '@/stores/library';
import {
  LIBRARY_EXPORT_MODES,
  type LibraryExportMode,
  type LibraryImportStrategy,
} from '@/types/library';
import type { SelectOption } from '@/types/ui';

const { t } = useI18n();
const library = useLibraryStore();
const strategy = ref<LibraryImportStrategy>('mergeSkipDuplicates');
const exportMode = ref<LibraryExportMode>('full');

const strategyOptions = computed<SelectOption[]>(() =>
  (['replace', 'merge', 'mergeSkipDuplicates'] as const).map((value) => ({
    value,
    label: t(`settings.importExport.strategy.options.${value}`),
  })),
);

const exportModeOptions = computed<SelectOption[]>(() =>
  LIBRARY_EXPORT_MODES.map((value) => ({
    value,
    label: t(`settings.importExport.mode.options.${value}`),
  })),
);

async function exportActive() {
  if (library.activeLibraryId !== null) {
    await library.exportLibrary(library.activeLibraryId, exportMode.value);
  }
}
</script>

<template>
  <div class="import_export_panel">
    <!-- Above the controls, not below them: an import locks the page, and the reason has to
         be on screen before the reader looks for what stopped answering.

         An `output` rather than a paragraph given the status role by hand: the element
         already carries that role, and it is announced where a bare role is not. -->
    <output
      v-if="library.isLibraryImporting"
      class="import_export_panel_busy"
      data-testid="import-busy"
    >
      <span class="import_export_panel_busy_spinner" aria-hidden="true" />
      {{ t('settings.importExport.busy') }}
    </output>

    <div class="import_export_panel_controls">
      <AppSelect
        v-model="strategy"
        class="import_export_panel_field"
        :label="t('settings.importExport.strategy.label')"
        :options="strategyOptions"
      />

      <AppButton
        :disabled="library.isLibraryImporting"
        data-testid="import-library-file"
        @click="library.importLibrary(strategy)"
      >
        <AppIcon name="import" />
        {{
          library.isLibraryImporting
            ? t('settings.importExport.importing')
            : t('settings.importExport.import')
        }}
      </AppButton>
    </div>

    <div class="import_export_panel_controls">
      <AppSelect
        v-model="exportMode"
        class="import_export_panel_field"
        :label="t('settings.importExport.mode.label')"
        :options="exportModeOptions"
        data-testid="export-mode"
      />

      <AppButton
        :disabled="library.activeLibraryId === null || library.isLibraryImporting"
        data-testid="export-active-library"
        @click="exportActive"
      >
        <AppIcon name="export" />
        {{ t('settings.importExport.export') }}
      </AppButton>
    </div>

    <p class="import_export_panel_hint" data-testid="export-mode-hint">
      {{ t(`settings.importExport.mode.hints.${exportMode}`) }}
    </p>

    <output
      v-if="library.lastLibraryImport !== null"
      class="import_export_panel_report common_surface_alt"
      data-testid="import-report-summary"
    >
      <span>
        {{
          t('settings.importExport.report.summary', {
            total: library.lastLibraryImport.total,
            added: library.lastLibraryImport.added,
            updated: library.lastLibraryImport.updated,
            skipped: library.lastLibraryImport.skipped,
            missing: library.lastLibraryImport.missing.length,
          })
        }}
      </span>
      <AppButton variant="ghost" @click="library.dismissLibraryImport()">
        {{ t('library.report.dismiss') }}
      </AppButton>
    </output>
  </div>
</template>

<style scoped lang="scss">
.import_export_panel {
  display: flex;
  flex-direction: column;
  gap: $space_md;

  &_controls {
    display: flex;
    gap: $space_md;
    align-items: flex-end;
    justify-content: space-between;
  }

  &_field {
    flex: 1;
  }

  &_hint {
    color: var(--color_text_muted);
    font-size: 0.8125em;
  }

  &_busy {
    display: flex;
    gap: $space_sm;
    align-items: center;
    padding: $space_sm $space_md;
    border-left: 3px solid var(--color_accent);
    border-radius: $radius_sm;
    background-color: var(--color_accent_soft);
    color: var(--color_text);
    font-size: 0.875em;

    &_spinner {
      flex-shrink: 0;
      width: 0.9rem;
      height: 0.9rem;
      border: 2px solid var(--color_accent);
      border-right-color: transparent;
      border-radius: 999px;
      animation: import_export_panel_spin 700ms linear infinite;
    }
  }

  &_report {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $space_md;
    font-size: 0.875em;
  }
}

@keyframes import_export_panel_spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .import_export_panel_busy_spinner {
    animation: none;
  }
}
</style>
