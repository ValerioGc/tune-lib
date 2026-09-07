import { isTauriRuntime } from '@/config/app-config';
import { normalizeAccentColor } from '@/services/accent';
import { isMandatoryTableColumn, normalizeTableColumnOrder } from '@/services/table-columns';
import {
  BANNER_DURATIONS,
  DEFAULT_SETTINGS,
  DEFAULT_TABLE_COLUMNS,
  LOCALES,
  MAX_COVER_GRADIENT_INTENSITY,
  MAX_DISMISSED_REPORT_LENGTH,
  MAX_PLAYER_BLUR,
  MIN_COVER_GRADIENT_INTENSITY,
  AMBIENT_DIRECTIONS,
  AMBIENT_STYLES,
  DOCK_CLOSE_ACTIONS,
  DOCK_LEVELS,
  DOCK_ORIENTATIONS,
  DOCK_PROGRESS_STYLES,
  type DockPosition,
  TABLE_COLUMN_KEYS,
  TABLE_COLUMN_WIDTHS,
  TEXT_SIZES,
  THEME_CHOICES,
  DEFAULT_PREVIEW_SIZES,
  PREVIEW_SIZES,
  PREVIEW_SIZE_PAGES,
  VIEW_MODES,
  type AppSettings,
  type BannerDuration,
  type PreviewSizes,
  type TableColumnKey,
  type TableColumnSetting,
} from '@/types/settings';

const STORE_FILE = 'settings.json';
const STORE_KEY = 'app-settings';

export interface SettingsStorage {
  load(): Promise<Partial<AppSettings>>;
  save(settings: AppSettings): Promise<void>;
}

function pickKnown<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** A position is kept only when both of its numbers survived the trip. */
function pickPosition(value: unknown): DockPosition | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { x, y } = value as Record<string, unknown>;

  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
    ? { x, y }
    : null;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function isTableColumnKey(value: unknown): value is TableColumnKey {
  return TABLE_COLUMN_KEYS.includes(value as TableColumnKey);
}

function sanitizeTableColumns(value: unknown): TableColumnSetting[] {
  const stored = Array.isArray(value) ? value : [];
  const byDefault = new Map(DEFAULT_TABLE_COLUMNS.map((column) => [column.key, column]));
  const seen = new Set<TableColumnKey>();
  const columns: TableColumnSetting[] = [];

  for (const raw of stored) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }

    const source = raw as Record<string, unknown>;

    if (!isTableColumnKey(source.key) || seen.has(source.key)) {
      continue;
    }

    const limits = TABLE_COLUMN_WIDTHS[source.key];
    const fallback = byDefault.get(source.key) ?? {
      key: source.key,
      visible: true,
      width: limits.default,
    };

    const storedVisible = typeof source.visible === 'boolean' ? source.visible : fallback.visible;

    columns.push({
      key: source.key,
      // A mandatory column is always shown, whatever the stored value says.
      visible: isMandatoryTableColumn(source.key) ? true : storedVisible,
      width: pickNumber(source.width, fallback.width, limits.min, limits.max),
    });
    seen.add(source.key);
  }

  for (const column of DEFAULT_TABLE_COLUMNS) {
    if (!seen.has(column.key)) {
      columns.push({ ...column });
    }
  }

  return normalizeTableColumnOrder(columns);
}

/** One size per page, each read on its own so a broken entry costs only itself. */
function sanitizePreviewSizes(raw: unknown): PreviewSizes {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  return Object.fromEntries(
    PREVIEW_SIZE_PAGES.map((page) => [
      page,
      pickKnown(PREVIEW_SIZES, source[page], DEFAULT_PREVIEW_SIZES[page]),
    ]),
  ) as PreviewSizes;
}

/** Turns untrusted persisted data into a complete, valid settings object. */
export function sanitizeSettings(raw: unknown): AppSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  return {
    locale: pickKnown(LOCALES, source.locale, DEFAULT_SETTINGS.locale),
    textSize: pickKnown(TEXT_SIZES, source.textSize, DEFAULT_SETTINGS.textSize),
    theme: pickKnown(THEME_CHOICES, source.theme, DEFAULT_SETTINGS.theme),
    accentColor: normalizeAccentColor(source.accentColor) ?? DEFAULT_SETTINGS.accentColor,
    ambientBackgroundEnabled:
      typeof source.ambientBackgroundEnabled === 'boolean'
        ? source.ambientBackgroundEnabled
        : DEFAULT_SETTINGS.ambientBackgroundEnabled,
    ambientStyle: pickKnown(AMBIENT_STYLES, source.ambientStyle, DEFAULT_SETTINGS.ambientStyle),
    ambientDirection: pickKnown(
      AMBIENT_DIRECTIONS,
      source.ambientDirection,
      DEFAULT_SETTINGS.ambientDirection,
    ),
    glassSurfacesEnabled:
      typeof source.glassSurfacesEnabled === 'boolean'
        ? source.glassSurfacesEnabled
        : DEFAULT_SETTINGS.glassSurfacesEnabled,
    viewMode: pickKnown(VIEW_MODES, source.viewMode, DEFAULT_SETTINGS.viewMode),
    previewSizes: sanitizePreviewSizes(source.previewSizes),
    mainLibraryId:
      typeof source.mainLibraryId === 'string' && source.mainLibraryId.trim().length > 0
        ? source.mainLibraryId
        : DEFAULT_SETTINGS.mainLibraryId,
    coverGradientEnabled:
      typeof source.coverGradientEnabled === 'boolean'
        ? source.coverGradientEnabled
        : DEFAULT_SETTINGS.coverGradientEnabled,
    coverGradientIntensity: pickNumber(
      source.coverGradientIntensity,
      DEFAULT_SETTINGS.coverGradientIntensity,
      MIN_COVER_GRADIENT_INTENSITY,
      MAX_COVER_GRADIENT_INTENSITY,
    ),
    playerTransparency: pickNumber(
      source.playerTransparency,
      DEFAULT_SETTINGS.playerTransparency,
      0,
      45,
    ),
    playerBlur: pickNumber(source.playerBlur, DEFAULT_SETTINGS.playerBlur, 0, MAX_PLAYER_BLUR),
    defaultPlayerBannerDismissed:
      typeof source.defaultPlayerBannerDismissed === 'boolean'
        ? source.defaultPlayerBannerDismissed
        : DEFAULT_SETTINGS.defaultPlayerBannerDismissed,
    ambientOnPanels: pickBoolean(source.ambientOnPanels, DEFAULT_SETTINGS.ambientOnPanels),
    closeToTray: pickBoolean(source.closeToTray, DEFAULT_SETTINGS.closeToTray),
    autostartEnabled: pickBoolean(source.autostartEnabled, DEFAULT_SETTINGS.autostartEnabled),
    autostartMinimized: pickBoolean(source.autostartMinimized, DEFAULT_SETTINGS.autostartMinimized),
    keepPlayerOpen: pickBoolean(source.keepPlayerOpen, DEFAULT_SETTINGS.keepPlayerOpen),
    miniPlayerEnabled: pickBoolean(source.miniPlayerEnabled, DEFAULT_SETTINGS.miniPlayerEnabled),
    miniPlayerAlwaysOnTop: pickBoolean(
      source.miniPlayerAlwaysOnTop,
      DEFAULT_SETTINGS.miniPlayerAlwaysOnTop,
    ),
    miniPlayerOrientation: pickKnown(
      DOCK_ORIENTATIONS,
      source.miniPlayerOrientation,
      DEFAULT_SETTINGS.miniPlayerOrientation,
    ),
    miniPlayerCloseAction: pickKnown(
      DOCK_CLOSE_ACTIONS,
      source.miniPlayerCloseAction,
      DEFAULT_SETTINGS.miniPlayerCloseAction,
    ),
    miniPlayerLevel: pickKnown(
      DOCK_LEVELS,
      source.miniPlayerLevel,
      DEFAULT_SETTINGS.miniPlayerLevel,
    ),
    miniPlayerRemembersLevel: pickBoolean(
      source.miniPlayerRemembersLevel,
      DEFAULT_SETTINGS.miniPlayerRemembersLevel,
    ),
    miniPlayerProgress: pickKnown(
      DOCK_PROGRESS_STYLES,
      source.miniPlayerProgress,
      DEFAULT_SETTINGS.miniPlayerProgress,
    ),
    miniPlayerGradient: pickBoolean(source.miniPlayerGradient, DEFAULT_SETTINGS.miniPlayerGradient),
    miniPlayerPosition: pickPosition(source.miniPlayerPosition),
    coverGradientStyle: pickKnown(
      AMBIENT_STYLES,
      source.coverGradientStyle,
      DEFAULT_SETTINGS.coverGradientStyle,
    ),
    coverGradientDirection: pickKnown(
      AMBIENT_DIRECTIONS,
      source.coverGradientDirection,
      DEFAULT_SETTINGS.coverGradientDirection,
    ),
    tableColumns: sanitizeTableColumns(source.tableColumns),
    tableColumnDividers: pickBoolean(
      source.tableColumnDividers,
      DEFAULT_SETTINGS.tableColumnDividers,
    ),
    bannerDuration: BANNER_DURATIONS.includes(source.bannerDuration as BannerDuration)
      ? (source.bannerDuration as BannerDuration)
      : DEFAULT_SETTINGS.bannerDuration,
    dismissedMissingReport:
      typeof source.dismissedMissingReport === 'string'
        ? source.dismissedMissingReport.slice(0, MAX_DISMISSED_REPORT_LENGTH)
        : DEFAULT_SETTINGS.dismissedMissingReport,
  };
}

export function createWebStorage(storage: Storage): SettingsStorage {
  return {
    load: async () => {
      const raw = storage.getItem(STORE_KEY);
      return raw === null ? {} : (JSON.parse(raw) as Partial<AppSettings>);
    },
    save: async (settings) => {
      storage.setItem(STORE_KEY, JSON.stringify(settings));
    },
  };
}

export function createTauriStorage(): SettingsStorage {
  const openStore = async () => {
    const { load } = await import('@tauri-apps/plugin-store');
    return load(STORE_FILE, { autoSave: false });
  };

  return {
    load: async () => {
      const store = await openStore();
      const raw = await store.get<Partial<AppSettings>>(STORE_KEY);
      return raw ?? {};
    },
    save: async (settings) => {
      const store = await openStore();
      await store.set(STORE_KEY, settings);
      await store.save();
    },
  };
}

export function createSettingsStorage(): SettingsStorage {
  if (isTauriRuntime()) {
    return createTauriStorage();
  }

  if (typeof localStorage !== 'undefined') {
    return createWebStorage(localStorage);
  }

  return { load: async () => ({}), save: async () => {} };
}
