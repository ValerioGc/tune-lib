import { setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestPinia } from '@tests/support/mount';

import { useNavigationStore } from '@/stores/navigation';

beforeEach(() => {
  setActivePinia(createTestPinia());
});

describe('useNavigationStore', () => {
  it('starts on the library', () => {
    const navigation = useNavigationStore();

    expect(navigation.view).toBe('library');
    expect(navigation.isLibrary).toBe(true);
    expect(navigation.isSettings).toBe(false);
    expect(navigation.isPlayer).toBe(false);
  });

  it('opens the requested view', () => {
    const navigation = useNavigationStore();

    navigation.go('settings');

    expect(navigation.isSettings).toBe(true);
    expect(navigation.isLibrary).toBe(false);
  });

  it('opens the player-only view', () => {
    const navigation = useNavigationStore();

    navigation.go('player');

    expect(navigation.isPlayer).toBe(true);
    expect(navigation.isLibrary).toBe(false);
  });

  it('the help icon toggles the view', () => {
    const navigation = useNavigationStore();

    navigation.toggleHelp();
    expect(navigation.view).toBe('help');
    expect(navigation.isHelp).toBe(true);

    navigation.toggleHelp();
    expect(navigation.view).toBe('library');
  });

  it('switches directly from one view to another', () => {
    const navigation = useNavigationStore();
    navigation.go('settings');

    navigation.toggleHelp();

    expect(navigation.view).toBe('help');
  });

  it('the settings icon toggles the view', () => {
    const navigation = useNavigationStore();

    navigation.toggleSettings();
    expect(navigation.view).toBe('settings');

    navigation.toggleSettings();
    expect(navigation.view).toBe('library');
  });
});
