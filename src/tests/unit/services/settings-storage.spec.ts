import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS, MAX_COVER_GRADIENT_INTENSITY, type AppSettings } from '@/types/settings';

import {
  createSettingsStorage,
  createTauriStorage,
  createWebStorage,
  sanitizeSettings,
} from '@/services/settings-storage';

const mocks = vi.hoisted(() => ({
  store: {
    get: vi.fn(),
    set: vi.fn(),
    save: vi.fn(),
  },
  load: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  load: (...args: unknown[]) => {
    mocks.load(...args);
    return Promise.resolve(mocks.store);
  },
}));

function createFakeStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
    key: () => null,
    get length() {
      return entries.size;
    },
  } as Storage;
}

const scopedWindow = window as unknown as Record<string, unknown>;

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('sanitizeSettings', () => {
  it('falls back to the defaults for missing data', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('not an object')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      locale: 'en',
      textSize: 'large',
      theme: 'dark',
      accentColor: '#107c10',
      ambientBackgroundEnabled: false,
      ambientStyle: 'linear',
      ambientDirection: 'bottomRight',
      glassSurfacesEnabled: false,
      viewMode: 'preview',
      mainLibraryId: 'lib-2',
      coverGradientEnabled: false,
      coverGradientIntensity: 120,
      playerTransparency: 30,
      playerBlur: 18,
      defaultPlayerBannerDismissed: true,
    };

    expect(sanitizeSettings(settings)).toEqual(settings);
  });

  it('discards individual invalid fields while keeping the others', () => {
    const sanitized = sanitizeSettings({ locale: 'pt', textSize: 'large', theme: 'neon' });

    expect(sanitized).toEqual({
      ...DEFAULT_SETTINGS,
      locale: DEFAULT_SETTINGS.locale,
      textSize: 'large',
      theme: DEFAULT_SETTINGS.theme,
    });
  });

  it('keeps the two ambience switches on unless they were turned off', () => {
    expect(sanitizeSettings({}).ambientBackgroundEnabled).toBe(true);
    expect(sanitizeSettings({}).glassSurfacesEnabled).toBe(true);
    expect(sanitizeSettings({ glassSurfacesEnabled: 'si' }).glassSurfacesEnabled).toBe(true);
    expect(sanitizeSettings({ ambientBackgroundEnabled: false }).ambientBackgroundEnabled).toBe(
      false,
    );
  });

  it('falls back to the default shape and origin of the background', () => {
    expect(sanitizeSettings({ ambientStyle: 'bolle' }).ambientStyle).toBe(
      DEFAULT_SETTINGS.ambientStyle,
    );
    expect(sanitizeSettings({ ambientDirection: 'diagonale' }).ambientDirection).toBe(
      DEFAULT_SETTINGS.ambientDirection,
    );
    expect(sanitizeSettings({ ambientStyle: 'spotlight' }).ambientStyle).toBe('spotlight');
  });

  it('normalizes the accent colour and refuses what is not one', () => {
    expect(sanitizeSettings({ accentColor: '#0AF' }).accentColor).toBe('#00aaff');
    expect(sanitizeSettings({ accentColor: 'blu' }).accentColor).toBe(DEFAULT_SETTINGS.accentColor);
  });

  it('clamps saved gradient, transparency and blur to valid values', () => {
    expect(
      sanitizeSettings({ coverGradientIntensity: 400, playerTransparency: 80, playerBlur: -4 }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      coverGradientIntensity: MAX_COVER_GRADIENT_INTENSITY,
      playerTransparency: 45,
      playerBlur: 0,
    });
  });

  it('keeps cover and title first when restoring table columns', () => {
    const sanitized = sanitizeSettings({
      tableColumns: [
        { key: 'genre', visible: true, width: 140 },
        { key: 'title', visible: true, width: 260 },
        { key: 'cover', visible: true, width: 48 },
        { key: 'artist', visible: true, width: 180 },
      ],
    });

    expect(sanitized.tableColumns.map((column) => column.key).slice(0, 4)).toEqual([
      'cover',
      'title',
      'genre',
      'artist',
    ]);
  });
});

describe('createWebStorage', () => {
  it('returns an empty object when nothing is saved', async () => {
    const storage = createWebStorage(createFakeStorage());

    await expect(storage.load()).resolves.toEqual({});
  });

  it('round-trips settings', async () => {
    const storage = createWebStorage(createFakeStorage());
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      mainLibraryId: null,
      coverGradientEnabled: true,
      coverGradientIntensity: 100,
      playerTransparency: 12,
      playerBlur: 12,
      defaultPlayerBannerDismissed: false,
    };

    await storage.save(settings);

    await expect(storage.load()).resolves.toEqual(settings);
  });
});

describe('createTauriStorage', () => {
  beforeEach(() => {
    mocks.store.get.mockResolvedValue(undefined);
    mocks.store.set.mockResolvedValue(undefined);
    mocks.store.save.mockResolvedValue(undefined);
  });

  it('reads settings from the plugin store', async () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      locale: 'en',
      textSize: 'large',
      theme: 'dark',
      accentColor: '#107c10',
      ambientBackgroundEnabled: false,
      ambientStyle: 'linear',
      ambientDirection: 'bottomRight',
      glassSurfacesEnabled: false,
      viewMode: 'preview',
      mainLibraryId: 'lib-2',
      coverGradientEnabled: false,
      coverGradientIntensity: 120,
      playerTransparency: 30,
      playerBlur: 18,
      defaultPlayerBannerDismissed: true,
    };
    mocks.store.get.mockResolvedValue(settings);

    await expect(createTauriStorage().load()).resolves.toEqual(settings);
    expect(mocks.load).toHaveBeenCalledWith('settings.json', { autoSave: false });
  });

  it('returns an empty object when the key does not exist', async () => {
    await expect(createTauriStorage().load()).resolves.toEqual({});
  });

  it('writes and persists to disk', async () => {
    await createTauriStorage().save(DEFAULT_SETTINGS);

    expect(mocks.store.set).toHaveBeenCalledWith('app-settings', DEFAULT_SETTINGS);
    expect(mocks.store.save).toHaveBeenCalledTimes(1);
  });
});

describe('createSettingsStorage', () => {
  it('uses the Tauri plugin when the app runs in the shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.store.get.mockResolvedValue(undefined);

    await createSettingsStorage().load();

    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('uses localStorage in the browser', async () => {
    const storage = createSettingsStorage();
    await storage.save({
      ...DEFAULT_SETTINGS,
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      mainLibraryId: 'lib-1',
      coverGradientEnabled: false,
      coverGradientIntensity: 120,
      playerTransparency: 20,
      playerBlur: 10,
      defaultPlayerBannerDismissed: true,
    });

    await expect(storage.load()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      locale: 'en',
      textSize: 'small',
      theme: 'light',
      viewMode: 'table',
      mainLibraryId: 'lib-1',
      coverGradientEnabled: false,
      coverGradientIntensity: 120,
      playerTransparency: 20,
      playerBlur: 10,
      defaultPlayerBannerDismissed: true,
    });
    expect(mocks.load).not.toHaveBeenCalled();

    localStorage.clear();
  });
});
