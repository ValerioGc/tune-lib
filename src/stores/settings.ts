import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { detectBrowserLocale, setI18nLocale } from '@/i18n';
import { normalizeAccentColor } from '@/services/accent';
import {
  applyAccent,
  applyAmbientBackground,
  applyDocumentLocale,
  applyGlassSurfaces,
  applyTextSize,
  applyTheme,
} from '@/services/appearance';
import {
  createSettingsStorage,
  sanitizeSettings,
  type SettingsStorage,
} from '@/services/settings-storage';
import {
  applyCloseToTray,
  applyMiniPlayerAlwaysOnTop,
  applyMiniPlayerShape,
  setAutostart,
} from '@/services/shell-integration';
import { getSystemTheme, watchSystemTheme } from '@/services/system-theme';
import {
  isLockedLeadingTableColumn,
  isMandatoryTableColumn,
  normalizeTableColumnOrder,
} from '@/services/table-columns';
import {
  DEFAULT_SETTINGS,
  LOCKED_LEADING_TABLE_COLUMN_KEYS,
  MAX_COVER_GRADIENT_INTENSITY,
  MAX_PLAYER_BLUR,
  MIN_COVER_GRADIENT_INTENSITY,
  TABLE_COLUMN_WIDTHS,
  type AmbientDirection,
  type AmbientStyle,
  type AppSettings,
  type BannerDuration,
  type DockCloseAction,
  type DockLevel,
  type DockOrientation,
  type DockPosition,
  type DockProgressStyle,
  type Locale,
  type ResolvedTheme,
  type TableColumnKey,
  type TableColumnSetting,
  type TextSize,
  type ThemeChoice,
  type PreviewSize,
  type PreviewSizePage,
  type PreviewSizes,
  type ViewMode,
} from '@/types/settings';

export const useSettingsStore = defineStore('settings', () => {
  const locale = ref<Locale>(DEFAULT_SETTINGS.locale);
  const textSize = ref<TextSize>(DEFAULT_SETTINGS.textSize);
  const theme = ref<ThemeChoice>(DEFAULT_SETTINGS.theme);
  const accentColor = ref(DEFAULT_SETTINGS.accentColor);
  const ambientBackgroundEnabled = ref(DEFAULT_SETTINGS.ambientBackgroundEnabled);
  const ambientStyle = ref<AmbientStyle>(DEFAULT_SETTINGS.ambientStyle);
  const ambientDirection = ref<AmbientDirection>(DEFAULT_SETTINGS.ambientDirection);
  const glassSurfacesEnabled = ref(DEFAULT_SETTINGS.glassSurfacesEnabled);
  const ambientOnPanels = ref(DEFAULT_SETTINGS.ambientOnPanels);
  const viewMode = ref<ViewMode>(DEFAULT_SETTINGS.viewMode);
  const previewSizes = ref<PreviewSizes>({ ...DEFAULT_SETTINGS.previewSizes });
  const mainLibraryId = ref<string | null>(DEFAULT_SETTINGS.mainLibraryId);
  const coverGradientEnabled = ref(DEFAULT_SETTINGS.coverGradientEnabled);
  const coverGradientIntensity = ref(DEFAULT_SETTINGS.coverGradientIntensity);
  const coverGradientStyle = ref<AmbientStyle>(DEFAULT_SETTINGS.coverGradientStyle);
  const coverGradientDirection = ref<AmbientDirection>(DEFAULT_SETTINGS.coverGradientDirection);
  const playerTransparency = ref(DEFAULT_SETTINGS.playerTransparency);
  const playerBlur = ref(DEFAULT_SETTINGS.playerBlur);
  const defaultPlayerBannerDismissed = ref(DEFAULT_SETTINGS.defaultPlayerBannerDismissed);
  const closeToTray = ref(DEFAULT_SETTINGS.closeToTray);
  const autostartEnabled = ref(DEFAULT_SETTINGS.autostartEnabled);
  const autostartMinimized = ref(DEFAULT_SETTINGS.autostartMinimized);
  const keepPlayerOpen = ref(DEFAULT_SETTINGS.keepPlayerOpen);
  const miniPlayerEnabled = ref(DEFAULT_SETTINGS.miniPlayerEnabled);
  const miniPlayerAlwaysOnTop = ref(DEFAULT_SETTINGS.miniPlayerAlwaysOnTop);
  const miniPlayerOrientation = ref<DockOrientation>(DEFAULT_SETTINGS.miniPlayerOrientation);
  const miniPlayerCloseAction = ref<DockCloseAction>(DEFAULT_SETTINGS.miniPlayerCloseAction);
  const miniPlayerLevel = ref<DockLevel>(DEFAULT_SETTINGS.miniPlayerLevel);
  const miniPlayerRemembersLevel = ref(DEFAULT_SETTINGS.miniPlayerRemembersLevel);
  const miniPlayerProgress = ref<DockProgressStyle>(DEFAULT_SETTINGS.miniPlayerProgress);
  const miniPlayerGradient = ref(DEFAULT_SETTINGS.miniPlayerGradient);
  const miniPlayerPosition = ref<DockPosition | null>(DEFAULT_SETTINGS.miniPlayerPosition);
  const tableColumns = ref<TableColumnSetting[]>(
    DEFAULT_SETTINGS.tableColumns.map((column) => ({ ...column })),
  );
  const tableColumnDividers = ref(DEFAULT_SETTINGS.tableColumnDividers);
  const bannerDuration = ref<BannerDuration>(DEFAULT_SETTINGS.bannerDuration);
  const dismissedMissingReport = ref(DEFAULT_SETTINGS.dismissedMissingReport);
  const systemTheme = ref<ResolvedTheme>('light');
  const isReady = ref(false);

  let storage: SettingsStorage | null = null;
  let stopSystemWatch: (() => void) | null = null;

  const resolvedTheme = computed<ResolvedTheme>(() =>
    theme.value === 'system' ? systemTheme.value : theme.value,
  );

  const settings = computed<AppSettings>(() => ({
    locale: locale.value,
    textSize: textSize.value,
    theme: theme.value,
    accentColor: accentColor.value,
    ambientBackgroundEnabled: ambientBackgroundEnabled.value,
    ambientStyle: ambientStyle.value,
    ambientDirection: ambientDirection.value,
    glassSurfacesEnabled: glassSurfacesEnabled.value,
    ambientOnPanels: ambientOnPanels.value,
    viewMode: viewMode.value,
    previewSizes: { ...previewSizes.value },
    mainLibraryId: mainLibraryId.value,
    coverGradientEnabled: coverGradientEnabled.value,
    coverGradientIntensity: coverGradientIntensity.value,
    coverGradientStyle: coverGradientStyle.value,
    coverGradientDirection: coverGradientDirection.value,
    playerTransparency: playerTransparency.value,
    playerBlur: playerBlur.value,
    defaultPlayerBannerDismissed: defaultPlayerBannerDismissed.value,
    closeToTray: closeToTray.value,
    autostartEnabled: autostartEnabled.value,
    autostartMinimized: autostartMinimized.value,
    keepPlayerOpen: keepPlayerOpen.value,
    miniPlayerEnabled: miniPlayerEnabled.value,
    miniPlayerAlwaysOnTop: miniPlayerAlwaysOnTop.value,
    miniPlayerOrientation: miniPlayerOrientation.value,
    miniPlayerCloseAction: miniPlayerCloseAction.value,
    miniPlayerLevel: miniPlayerLevel.value,
    miniPlayerRemembersLevel: miniPlayerRemembersLevel.value,
    miniPlayerProgress: miniPlayerProgress.value,
    miniPlayerGradient: miniPlayerGradient.value,
    miniPlayerPosition: miniPlayerPosition.value,
    tableColumns: tableColumns.value,
    tableColumnDividers: tableColumnDividers.value,
    bannerDuration: bannerDuration.value,
    dismissedMissingReport: dismissedMissingReport.value,
  }));

  function apply() {
    applyTheme(resolvedTheme.value);
    applyAccent(accentColor.value, resolvedTheme.value);
    applyAmbientBackground({
      color: accentColor.value,
      theme: resolvedTheme.value,
      enabled: ambientBackgroundEnabled.value,
      style: ambientStyle.value,
      direction: ambientDirection.value,
      panels: ambientOnPanels.value,
    });
    applyGlassSurfaces(glassSurfacesEnabled.value);
    applyTextSize(textSize.value);
    applyDocumentLocale(locale.value);
    setI18nLocale(locale.value);
  }

  async function persist() {
    try {
      await storage?.save(settings.value);
    } catch (error) {
      console.error('Unable to persist the application settings', error);
    }
  }

  async function readStored(): Promise<Partial<AppSettings>> {
    try {
      return (await storage?.load()) ?? {};
    } catch (error) {
      console.error('Unable to read the persisted settings, falling back to defaults', error);
      return {};
    }
  }

  /** Loads the persisted preferences, applies them and starts following the system theme. */
  async function initialize(injectedStorage?: SettingsStorage) {
    storage = injectedStorage ?? createSettingsStorage();

    systemTheme.value = getSystemTheme();
    stopSystemWatch?.();
    stopSystemWatch = watchSystemTheme((next) => {
      systemTheme.value = next;
      apply();
    });

    const stored = await readStored();
    const restored = sanitizeSettings({
      ...stored,
      locale: stored.locale ?? detectBrowserLocale(),
    });

    locale.value = restored.locale;
    textSize.value = restored.textSize;
    theme.value = restored.theme;
    accentColor.value = restored.accentColor;
    ambientBackgroundEnabled.value = restored.ambientBackgroundEnabled;
    ambientStyle.value = restored.ambientStyle;
    ambientDirection.value = restored.ambientDirection;
    glassSurfacesEnabled.value = restored.glassSurfacesEnabled;
    ambientOnPanels.value = restored.ambientOnPanels;
    viewMode.value = restored.viewMode;
    previewSizes.value = { ...restored.previewSizes };
    mainLibraryId.value = restored.mainLibraryId;
    coverGradientEnabled.value = restored.coverGradientEnabled;
    coverGradientStyle.value = restored.coverGradientStyle;
    coverGradientDirection.value = restored.coverGradientDirection;
    coverGradientIntensity.value = restored.coverGradientIntensity;
    playerTransparency.value = restored.playerTransparency;
    playerBlur.value = restored.playerBlur;
    defaultPlayerBannerDismissed.value = restored.defaultPlayerBannerDismissed;
    closeToTray.value = restored.closeToTray;
    autostartEnabled.value = restored.autostartEnabled;
    autostartMinimized.value = restored.autostartMinimized;
    keepPlayerOpen.value = restored.keepPlayerOpen;
    miniPlayerEnabled.value = restored.miniPlayerEnabled;
    miniPlayerAlwaysOnTop.value = restored.miniPlayerAlwaysOnTop;
    miniPlayerOrientation.value = restored.miniPlayerOrientation;
    miniPlayerCloseAction.value = restored.miniPlayerCloseAction;
    miniPlayerLevel.value = restored.miniPlayerLevel;
    miniPlayerRemembersLevel.value = restored.miniPlayerRemembersLevel;
    miniPlayerProgress.value = restored.miniPlayerProgress;
    miniPlayerGradient.value = restored.miniPlayerGradient;
    miniPlayerPosition.value = restored.miniPlayerPosition;
    await applyCloseToTray(closeToTray.value);
    tableColumns.value = restored.tableColumns.map((column) => ({ ...column }));
    tableColumnDividers.value = restored.tableColumnDividers;
    bannerDuration.value = restored.bannerDuration;
    dismissedMissingReport.value = restored.dismissedMissingReport;

    apply();
    isReady.value = true;
  }

  async function setLocale(next: Locale) {
    locale.value = next;
    apply();
    await persist();
  }

  async function setTextSize(next: TextSize) {
    textSize.value = next;
    apply();
    await persist();
  }

  // The chosen library view is remembered across sessions.
  async function setViewMode(next: ViewMode) {
    viewMode.value = next;
    await persist();
  }

  // As is the size of its cards, page by page: the choice made in a view is the one that
  // comes back to it.
  async function setPreviewSize(page: PreviewSizePage, next: PreviewSize) {
    previewSizes.value = { ...previewSizes.value, [page]: next };
    await persist();
  }

  async function setMainLibraryId(id: string | null) {
    mainLibraryId.value = id;
    await persist();
  }

  /** Ignores a colour the picker cannot parse: the interface keeps the previous accent. */
  async function setAccentColor(next: string) {
    const normalized = normalizeAccentColor(next);

    if (normalized === null) {
      return;
    }

    accentColor.value = normalized;
    apply();
    await persist();
  }

  async function resetAccentColor() {
    await setAccentColor(DEFAULT_SETTINGS.accentColor);
  }

  async function setAmbientBackgroundEnabled(next: boolean) {
    ambientBackgroundEnabled.value = next;
    apply();
    await persist();
  }

  async function setAmbientStyle(next: AmbientStyle) {
    ambientStyle.value = next;
    apply();
    await persist();
  }

  async function setAmbientDirection(next: AmbientDirection) {
    ambientDirection.value = next;
    apply();
    await persist();
  }

  async function setGlassSurfacesEnabled(next: boolean) {
    glassSurfacesEnabled.value = next;
    apply();
    await persist();
  }

  async function setTheme(next: ThemeChoice) {
    theme.value = next;
    apply();
    await persist();
  }

  async function setCoverGradientEnabled(next: boolean) {
    coverGradientEnabled.value = next;
    await persist();
  }

  async function setCoverGradientStyle(next: AmbientStyle) {
    coverGradientStyle.value = next;
    await persist();
  }

  async function setCoverGradientDirection(next: AmbientDirection) {
    coverGradientDirection.value = next;
    await persist();
  }

  async function setCoverGradientIntensity(next: number) {
    coverGradientIntensity.value = Math.min(
      MAX_COVER_GRADIENT_INTENSITY,
      Math.max(MIN_COVER_GRADIENT_INTENSITY, next),
    );
    await persist();
  }

  async function setPlayerTransparency(next: number) {
    playerTransparency.value = Math.min(45, Math.max(0, next));
    await persist();
  }

  async function setPlayerBlur(next: number) {
    playerBlur.value = Math.min(MAX_PLAYER_BLUR, Math.max(0, next));
    await persist();
  }

  /** The same background of the window, painted on the panels that open over it. */
  async function setAmbientOnPanels(next: boolean) {
    ambientOnPanels.value = next;
    apply();
    await persist();
  }

  async function setCloseToTray(next: boolean) {
    closeToTray.value = next;
    await applyCloseToTray(next);
    await persist();
  }

  async function setAutostartEnabled(next: boolean) {
    autostartEnabled.value = next;
    await setAutostart(next);
    await persist();
  }

  /** Read at launch, when the app decides whether to show itself or wait in the tray. */
  async function setAutostartMinimized(next: boolean) {
    autostartMinimized.value = next;
    await persist();
  }

  async function setMiniPlayerEnabled(next: boolean) {
    miniPlayerEnabled.value = next;
    await persist();
  }

  /** The dock is reshaped where it stands: the window follows without being reopened. */
  async function reshapeMiniPlayer() {
    await applyMiniPlayerShape(
      miniPlayerOrientation.value === 'vertical',
      miniPlayerAlwaysOnTop.value,
      miniPlayerLevel.value === 'expanded',
    );
  }

  async function setMiniPlayerAlwaysOnTop(next: boolean) {
    miniPlayerAlwaysOnTop.value = next;
    await applyMiniPlayerAlwaysOnTop(next);
    await persist();
  }

  async function setMiniPlayerOrientation(next: DockOrientation) {
    miniPlayerOrientation.value = next;
    await reshapeMiniPlayer();
    await persist();
  }

  /**
   * The level the dock is in. It is written down only when asked to be remembered: without
   * that, the dock opens in the level chosen in the settings whatever it was left in.
   */
  async function setMiniPlayerLevel(next: DockLevel, remembered = true) {
    miniPlayerLevel.value = next;
    await reshapeMiniPlayer();

    if (remembered) {
      await persist();
    }
  }

  async function setMiniPlayerRemembersLevel(next: boolean) {
    miniPlayerRemembersLevel.value = next;
    await persist();
  }

  async function setMiniPlayerProgress(next: DockProgressStyle) {
    miniPlayerProgress.value = next;
    await persist();
  }

  async function setMiniPlayerGradient(next: boolean) {
    miniPlayerGradient.value = next;
    await persist();
  }

  /** Where the dock was left, so it comes back to the same corner of the screen. */
  async function setMiniPlayerPosition(next: DockPosition) {
    miniPlayerPosition.value = next;
    await persist();
  }

  /** Remembered from the dock, when the question was answered once and for all. */
  async function setMiniPlayerCloseAction(next: DockCloseAction) {
    miniPlayerCloseAction.value = next;
    await persist();
  }

  async function setKeepPlayerOpen(next: boolean) {
    keepPlayerOpen.value = next;
    await persist();
  }

  async function dismissDefaultPlayerBanner() {
    defaultPlayerBannerDismissed.value = true;
    await persist();
  }

  async function setTableColumnVisible(key: TableColumnKey, visible: boolean) {
    // A mandatory column stays on screen whatever was asked of it.
    const nextVisible = isMandatoryTableColumn(key) ? true : visible;

    tableColumns.value = tableColumns.value.map((column) =>
      column.key === key ? { ...column, visible: nextVisible } : column,
    );
    await persist();
  }

  async function setTableColumnWidth(key: TableColumnKey, width: number) {
    const limits = TABLE_COLUMN_WIDTHS[key];
    tableColumns.value = tableColumns.value.map((column) =>
      column.key === key
        ? { ...column, width: Math.min(limits.max, Math.max(limits.min, width)) }
        : column,
    );
    await persist();
  }

  async function setTableColumnWidths(widths: Partial<Record<TableColumnKey, number>>) {
    tableColumns.value = tableColumns.value.map((column) => {
      const width = widths[column.key];

      if (width === undefined) {
        return column;
      }

      const limits = TABLE_COLUMN_WIDTHS[column.key];
      return { ...column, width: Math.min(limits.max, Math.max(limits.min, width)) };
    });
    await persist();
  }

  async function moveTableColumn(key: TableColumnKey, targetKey: TableColumnKey) {
    if (key === targetKey || isLockedLeadingTableColumn(key)) {
      return;
    }

    const columns = tableColumns.value.filter((column) => column.key !== key);
    const moved = tableColumns.value.find((column) => column.key === key);
    const rawTargetIndex = columns.findIndex((column) => column.key === targetKey);

    if (moved === undefined || rawTargetIndex < 0) {
      return;
    }

    const lockedCount = LOCKED_LEADING_TABLE_COLUMN_KEYS.length;
    const targetIndex = Math.max(rawTargetIndex, lockedCount);

    columns.splice(targetIndex, 0, moved);
    tableColumns.value = normalizeTableColumnOrder(columns);
    await persist();
  }

  async function nudgeTableColumn(key: TableColumnKey, direction: -1 | 1) {
    if (isLockedLeadingTableColumn(key)) {
      return;
    }

    const index = tableColumns.value.findIndex((column) => column.key === key);
    const target = tableColumns.value[index + direction];

    if (index < 0 || target === undefined || isLockedLeadingTableColumn(target.key)) {
      return;
    }

    const columns = [...tableColumns.value];
    columns.splice(index, 1);
    columns.splice(index + direction, 0, tableColumns.value[index]!);
    tableColumns.value = normalizeTableColumnOrder(columns);
    await persist();
  }

  async function setBannerDuration(next: BannerDuration) {
    bannerDuration.value = next;
    await persist();
  }

  /**
   * Writes down which report of missing files was closed, so it is not raised again.
   *
   * The banner is a piece of news, not a state: the count beside the tabs is what keeps the
   * situation on screen. An empty key clears the memory, which is what a check finding
   * nothing missing leaves behind.
   */
  async function setDismissedMissingReport(next: string) {
    dismissedMissingReport.value = next;
    await persist();
  }

  async function setTableColumnDividers(next: boolean) {
    tableColumnDividers.value = next;
    await persist();
  }

  async function resetTableColumns() {
    tableColumns.value = DEFAULT_SETTINGS.tableColumns.map((column) => ({ ...column }));
    tableColumnDividers.value = DEFAULT_SETTINGS.tableColumnDividers;
    await persist();
  }

  function dispose() {
    stopSystemWatch?.();
    stopSystemWatch = null;
  }

  return {
    locale,
    textSize,
    theme,
    accentColor,
    ambientBackgroundEnabled,
    ambientStyle,
    ambientDirection,
    glassSurfacesEnabled,
    ambientOnPanels,
    viewMode,
    previewSizes,
    mainLibraryId,
    coverGradientEnabled,
    coverGradientIntensity,
    coverGradientStyle,
    coverGradientDirection,
    playerTransparency,
    playerBlur,
    defaultPlayerBannerDismissed,
    closeToTray,
    autostartEnabled,
    autostartMinimized,
    keepPlayerOpen,
    miniPlayerEnabled,
    miniPlayerAlwaysOnTop,
    miniPlayerOrientation,
    miniPlayerCloseAction,
    miniPlayerLevel,
    miniPlayerRemembersLevel,
    miniPlayerProgress,
    miniPlayerGradient,
    miniPlayerPosition,
    tableColumns,
    tableColumnDividers,
    bannerDuration,
    dismissedMissingReport,
    systemTheme,
    isReady,
    resolvedTheme,
    settings,
    initialize,
    setLocale,
    setTextSize,
    setTheme,
    setAccentColor,
    resetAccentColor,
    setAmbientBackgroundEnabled,
    setAmbientStyle,
    setAmbientDirection,
    setGlassSurfacesEnabled,
    setViewMode,
    setPreviewSize,
    setMainLibraryId,
    setCoverGradientEnabled,
    setCoverGradientIntensity,
    setCoverGradientStyle,
    setCoverGradientDirection,
    setPlayerTransparency,
    setPlayerBlur,
    dismissDefaultPlayerBanner,
    setAmbientOnPanels,
    setCloseToTray,
    setAutostartEnabled,
    setAutostartMinimized,
    setKeepPlayerOpen,
    setMiniPlayerEnabled,
    setMiniPlayerAlwaysOnTop,
    setMiniPlayerOrientation,
    setMiniPlayerCloseAction,
    setMiniPlayerLevel,
    setMiniPlayerRemembersLevel,
    setMiniPlayerProgress,
    setMiniPlayerGradient,
    setMiniPlayerPosition,
    setTableColumnVisible,
    setTableColumnWidth,
    setTableColumnWidths,
    setTableColumnDividers,
    setBannerDuration,
    setDismissedMissingReport,
    moveTableColumn,
    nudgeTableColumn,
    resetTableColumns,
    dispose,
  };
});
