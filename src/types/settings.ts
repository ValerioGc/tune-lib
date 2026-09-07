export const LOCALES = ['it', 'en', 'fr', 'es', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const TEXT_SIZES = ['xsmall', 'small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export const THEME_CHOICES = ['light', 'dark', 'system'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ResolvedTheme = 'light' | 'dark';

/** Accent colours offered as swatches. The first one is the default of the interface. */
export const ACCENT_PRESETS = [
  '#0067c0',
  '#0099bc',
  '#038387',
  '#107c10',
  '#498205',
  '#986f0b',
  '#ca5010',
  '#c42b1c',
  '#e3008c',
  '#c239b3',
  '#8764b8',
  '#4f6bed',
] as const;

export const DEFAULT_ACCENT_COLOR = ACCENT_PRESETS[0];

/** How the ambient background is drawn. */
export const AMBIENT_STYLES = ['orbs', 'linear', 'spotlight'] as const;
export type AmbientStyle = (typeof AMBIENT_STYLES)[number];

/** Where the background starts from: the corner or the side the accent comes in on. */
export const AMBIENT_DIRECTIONS = [
  'topLeft',
  'top',
  'topRight',
  'left',
  'right',
  'bottomLeft',
  'bottom',
  'bottomRight',
] as const;
export type AmbientDirection = (typeof AMBIENT_DIRECTIONS)[number];

/** Which way the floating dock lays out its controls. */
export const DOCK_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type DockOrientation = (typeof DOCK_ORIENTATIONS)[number];

/** How much of itself the dock shows. */
export const DOCK_LEVELS = ['compact', 'expanded'] as const;
export type DockLevel = (typeof DOCK_LEVELS)[number];

/** How the dock draws the progress of the track. */
export const DOCK_PROGRESS_STYLES = ['bar', 'line', 'none'] as const;
export type DockProgressStyle = (typeof DOCK_PROGRESS_STYLES)[number];

/** Where the dock was left on screen, in logical pixels. */
export interface DockPosition {
  x: number;
  y: number;
}

/** What closing the dock does, once the question has been answered for good. */
export const DOCK_CLOSE_ACTIONS = ['ask', 'dock', 'app'] as const;
export type DockCloseAction = (typeof DOCK_CLOSE_ACTIONS)[number];

export const VIEW_MODES = ['table', 'preview'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/** How large the cards of the preview are, from the most per row to the fewest. */
export const PREVIEW_SIZES = ['small', 'medium', 'large'] as const;
export type PreviewSize = (typeof PREVIEW_SIZES)[number];

/**
 * The pages that show cards, each remembering a size of its own.
 *
 * A wall of track covers and a list of twelve artists are not looked at the same way, and
 * the size that suits one is rarely the size that suits the other.
 */
export const PREVIEW_SIZE_PAGES = ['tracks', 'artists', 'albums', 'genres'] as const;
export type PreviewSizePage = (typeof PREVIEW_SIZE_PAGES)[number];

export type PreviewSizes = Record<PreviewSizePage, PreviewSize>;

export const DEFAULT_PREVIEW_SIZES: PreviewSizes = {
  tracks: 'medium',
  artists: 'medium',
  albums: 'medium',
  genres: 'medium',
};

export const TABLE_COLUMN_KEYS = [
  'cover',
  'title',
  'artist',
  'album',
  'year',
  'genre',
  'format',
  'path',
  'duration',
] as const;
export type TableColumnKey = (typeof TABLE_COLUMN_KEYS)[number];

export const MANDATORY_TABLE_COLUMN_KEYS = ['cover', 'title', 'duration'] as const;
export const LOCKED_LEADING_TABLE_COLUMN_KEYS = ['cover', 'title'] as const;

export interface TableColumnSetting {
  key: TableColumnKey;
  visible: boolean;
  width: number;
}

export const TABLE_COLUMN_WIDTHS: Record<
  TableColumnKey,
  { min: number; max: number; default: number }
> = {
  // Starts at its narrowest, and its narrowest is the height of a row (`LIBRARY_ROW_HEIGHT_REM`
  // at the default text size): under that the picture would be narrower than the row is tall
  // and stop being a square. Widening the column makes the row grow with it.
  cover: { min: 56, max: 80, default: 56 },
  title: { min: 180, max: 520, default: 260 },
  artist: { min: 120, max: 360, default: 180 },
  album: { min: 120, max: 360, default: 180 },
  year: { min: 64, max: 120, default: 72 },
  genre: { min: 110, max: 260, default: 140 },
  format: { min: 72, max: 160, default: 90 },
  path: { min: 180, max: 560, default: 300 },
  duration: { min: 76, max: 140, default: 90 },
};

export const DEFAULT_TABLE_COLUMNS: TableColumnSetting[] = TABLE_COLUMN_KEYS.map((key) => ({
  key,
  visible: !['format', 'path'].includes(key),
  width: TABLE_COLUMN_WIDTHS[key].default,
}));

/**
 * How long a banner of the library stays on screen, in seconds.
 *
 * Zero means it stays until it is closed by hand: what a banner reports is worth reading,
 * and a reader who wants to take their time should not have to race the clock.
 */
export const BANNER_DURATIONS = [0, 3, 5, 8, 15] as const;

/**
 * How long the name of a dismissed missing-file report may be.
 *
 * It is written by the app and read back as an opaque value, so the limit is only there to
 * stop a hand-edited preferences file from carrying something unbounded.
 */
export const MAX_DISMISSED_REPORT_LENGTH = 64;
export type BannerDuration = (typeof BANNER_DURATIONS)[number];

export const MAX_PLAYER_BLUR = 28;
export const MIN_COVER_GRADIENT_INTENSITY = 0;
export const MAX_COVER_GRADIENT_INTENSITY = 150;

export interface AppSettings {
  locale: Locale;
  textSize: TextSize;
  theme: ThemeChoice;
  accentColor: string;
  ambientBackgroundEnabled: boolean;
  ambientStyle: AmbientStyle;
  ambientDirection: AmbientDirection;
  glassSurfacesEnabled: boolean;
  ambientOnPanels: boolean;
  viewMode: ViewMode;
  previewSizes: PreviewSizes;
  mainLibraryId: string | null;
  coverGradientEnabled: boolean;
  coverGradientIntensity: number;
  coverGradientStyle: AmbientStyle;
  coverGradientDirection: AmbientDirection;
  playerTransparency: number;
  playerBlur: number;
  defaultPlayerBannerDismissed: boolean;
  closeToTray: boolean;
  autostartEnabled: boolean;
  autostartMinimized: boolean;
  keepPlayerOpen: boolean;
  miniPlayerEnabled: boolean;
  miniPlayerAlwaysOnTop: boolean;
  miniPlayerOrientation: DockOrientation;
  miniPlayerCloseAction: DockCloseAction;
  miniPlayerLevel: DockLevel;
  miniPlayerRemembersLevel: boolean;
  miniPlayerProgress: DockProgressStyle;
  miniPlayerGradient: boolean;
  miniPlayerPosition: DockPosition | null;
  tableColumns: TableColumnSetting[];
  tableColumnDividers: boolean;
  bannerDuration: BannerDuration;
  dismissedMissingReport: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: 'it',
  textSize: 'medium',
  theme: 'system',
  accentColor: DEFAULT_ACCENT_COLOR,
  ambientBackgroundEnabled: true,
  ambientStyle: 'orbs',
  ambientDirection: 'topLeft',
  glassSurfacesEnabled: true,
  ambientOnPanels: true,
  viewMode: 'table',
  previewSizes: DEFAULT_PREVIEW_SIZES,
  mainLibraryId: null,
  coverGradientEnabled: true,
  coverGradientIntensity: 100,
  coverGradientStyle: 'orbs',
  coverGradientDirection: 'topLeft',
  playerTransparency: 12,
  playerBlur: 12,
  defaultPlayerBannerDismissed: false,
  closeToTray: false,
  autostartEnabled: false,
  autostartMinimized: false,
  keepPlayerOpen: false,
  miniPlayerEnabled: true,
  miniPlayerAlwaysOnTop: true,
  miniPlayerOrientation: 'horizontal',
  miniPlayerCloseAction: 'ask',
  miniPlayerLevel: 'compact',
  miniPlayerRemembersLevel: true,
  miniPlayerProgress: 'bar',
  miniPlayerGradient: true,
  miniPlayerPosition: null,
  tableColumns: DEFAULT_TABLE_COLUMNS,
  tableColumnDividers: false,
  bannerDuration: 5,
  dismissedMissingReport: '',
};
