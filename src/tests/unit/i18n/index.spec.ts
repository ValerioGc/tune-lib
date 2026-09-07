import { afterEach, describe, expect, it } from 'vitest';

import italianHelp from '@/locales/help/it.json';
import italianMessages from '@/locales/it.json';
import { DEFAULT_SETTINGS, LOCALES } from '@/types/settings';

import { detectBrowserLocale, detectLocale, i18n, isSupportedLocale, setI18nLocale } from '@/i18n';

function flattenKeys(source: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return typeof value === 'object' && value !== null
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

afterEach(() => {
  setI18nLocale(DEFAULT_SETTINGS.locale);
});

describe('i18n', () => {
  const italianLocale = { ...italianMessages, help: italianHelp };

  it('starts from the default language', () => {
    expect(i18n.global.locale.value).toBe(DEFAULT_SETTINGS.locale);
  });

  it('changes the active language', () => {
    setI18nLocale('en');

    expect(i18n.global.locale.value).toBe('en');
    expect(i18n.global.t('settings.title')).toBe('Settings');
  });

  it.each(LOCALES)('exposes the same keys in %s', (locale) => {
    const italianKeys = flattenKeys(italianLocale).sort();
    const translatedKeys = flattenKeys(i18n.global.getLocaleMessage(locale)).sort();

    expect(translatedKeys).toEqual(italianKeys);
  });

  it('does not leave empty translations', () => {
    const translations = Object.entries(italianLocale).flatMap(([key, value]) => {
      const paths = flattenKeys({ [key]: value });

      return paths.map((path) => ({
        path,
        value: path.split('.').reduce<unknown>((current, segment) => {
          if (typeof current !== 'object' || current === null) {
            return undefined;
          }

          return (current as Record<string, unknown>)[segment];
        }, italianLocale),
      }));
    });

    expect(translations.length).toBeGreaterThan(0);
    expect(
      translations.filter(({ value }) => typeof value !== 'string' || value.trim().length === 0),
    ).toEqual([]);
  });
});

describe('isSupportedLocale', () => {
  it('recognizes declared languages', () => {
    expect(LOCALES.every((locale) => isSupportedLocale(locale))).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isSupportedLocale('pt')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
    expect(isSupportedLocale(42)).toBe(false);
  });
});

describe('detectLocale', () => {
  it('chooses the first supported preference', () => {
    expect(detectLocale(['en-US', 'it-IT'])).toBe('en');
    expect(detectLocale(['pt-BR', 'it-IT'])).toBe('it');
    expect(detectLocale(['de-DE', 'it-IT'])).toBe('de');
    expect(detectLocale(['es-MX'])).toBe('es');
    expect(detectLocale(['fr-CA'])).toBe('fr');
  });

  it('ignores the region code', () => {
    expect(detectLocale(['EN-gb'])).toBe('en');
  });

  it('falls back to the default language', () => {
    expect(detectLocale([])).toBe(DEFAULT_SETTINGS.locale);
    expect(detectLocale(['pt', 'ja'])).toBe(DEFAULT_SETTINGS.locale);
  });

  it('reads browser preferences', () => {
    expect(LOCALES).toContain(detectBrowserLocale());
  });
});
