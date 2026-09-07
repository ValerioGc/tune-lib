/**
 * Single place where the glyphs used by the interface live.
 *
 * Text rather than pictures: a glyph follows the colour and the size of what it sits in,
 * costs nothing to load and never falls out of step with the text beside it. Every one of
 * them is drawn by the system font on both target platforms.
 */
export const ICON_GLYPHS = {
  remove: '✕',
  edit: '✎',
  note: '♪',
  sortAsc: '▲',
  sortDesc: '▼',
  warning: '⚠',
  settings: '⚙',
  expand: '▲',
  collapse: '▼',
  close: '✕',
  play: '▶',
  pause: '❙❙',
  stop: '■',
  previous: '❮❮',
  next: '❯❯',
  shuffle: '⤨',
  volume: '◀))',
  mute: '◀✕',
  switch: '⇄',
  repeatOne: '↻¹',
  list: '☰',
  grid: '▦',
  external: '↗',
  minimize: '─',
  tray: '▁',
  maximize: '▢',
  resize: '↔',
  help: '?',
  info: 'i',
  back: '←',
  add: '＋',
  search: '⌕',
  more: '⋮',
  // Text presentation keeps the inactive pin monochrome; the active state colours it via CSS.
  pin: '📌︎',
  verify: '✓',
  duplicate: '⧉',
  check: '✔',
  drag: '⠿',
  export: '⤓',
  import: '⤒',
} as const;

export type IconName = keyof typeof ICON_GLYPHS;
