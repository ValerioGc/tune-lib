/** Units the sizes are shown in. Beyond gigabytes there is nothing this app can produce. */
const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

const STEP = 1024;

/**
 * A size in bytes, written the way a person reads it.
 *
 * The number goes through `Intl` so the decimal separator is the one of the language in
 * use: `1,4 MB` in Italian, `1.4 MB` in English. Bytes are shown whole — half a byte means
 * nothing — and everything above gets one decimal.
 */
export function formatBytes(bytes: number, locale: string): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;

  let size = safe;
  let unit = 0;

  while (size >= STEP && unit < UNITS.length - 1) {
    size /= STEP;
    unit += 1;
  }

  const digits = unit === 0 ? 0 : 1;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(size);

  return `${formatted} ${UNITS[unit]}`;
}
