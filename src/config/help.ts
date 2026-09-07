import type { IconName } from '@/config/icons';

/**
 * Topics of the in-app guide, in reading order. Each one has a title, where to find the
 * feature, short sections and one closing tip, all in the translation files under
 * `help.topics.<id>`.
 *
 * The index of the guide is built from this list: adding a topic here and its strings in
 * the translations is enough for it to appear.
 */
export const HELP_TOPICS = [
  'start',
  'import',
  'organize',
  'views',
  'metadata',
  'files',
  'player',
  'dock',
  'shortcuts',
  'libraries',
  'transfer',
  'appearance',
  'settings',
  'storage',
] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

export const HELP_TOPIC_ICONS: Record<HelpTopic, IconName> = {
  start: 'play',
  import: 'add',
  organize: 'search',
  views: 'list',
  metadata: 'edit',
  files: 'verify',
  player: 'play',
  dock: 'tray',
  shortcuts: 'drag',
  libraries: 'switch',
  transfer: 'export',
  appearance: 'grid',
  settings: 'settings',
  storage: 'info',
};

/**
 * Where a topic points on its screenshot.
 *
 * `file` names a picture in `src/assets/help`; `arrow` is the point its tip lands on, in
 * per cent of the width and the height of that picture, with the angle it comes in at —
 * `0` points right, `90` points down. See the in-app guide section in `DEVELOPMENT.md`.
 */
export interface HelpFigureSpec {
  file: string;
  arrow: { x: number; y: number; angle: number };
}

/**
 * The topics that carry a figure.
 *
 * A topic listed here without its picture in place shows no figure at all, so entries can
 * be declared before the screenshots exist.
 */
export const HELP_TOPIC_FIGURES: Partial<Record<HelpTopic, HelpFigureSpec>> = {
  start: { file: 'start.png', arrow: { x: 24, y: 16, angle: 200 } },
  import: { file: 'import.png', arrow: { x: 22, y: 14, angle: 200 } },
  organize: { file: 'organize.png', arrow: { x: 46, y: 14, angle: 205 } },
  views: { file: 'views.png', arrow: { x: 88, y: 14, angle: 340 } },
  metadata: { file: 'metadata.png', arrow: { x: 94, y: 42, angle: 340 } },
  player: { file: 'player.png', arrow: { x: 50, y: 82, angle: 130 } },
  dock: { file: 'dock.png', arrow: { x: 50, y: 30, angle: 200 } },
  libraries: { file: 'libraries.png', arrow: { x: 30, y: 14, angle: 200 } },
  transfer: { file: 'transfer.png', arrow: { x: 40, y: 40, angle: 200 } },
  settings: { file: 'settings.png', arrow: { x: 92, y: 10, angle: 340 } },
};
