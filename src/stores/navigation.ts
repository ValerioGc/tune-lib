import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

/**
 * Which top level view is on screen.
 *
 * The app has a handful of flat views and no addressable URLs, so a router would only add
 * machinery: a single piece of state is enough to switch between them.
 */
export const APP_VIEWS = ['library', 'settings', 'help', 'player'] as const;
export type AppView = (typeof APP_VIEWS)[number];
export type SettingsFocus = 'player' | null;

export const useNavigationStore = defineStore('navigation', () => {
  const view = ref<AppView>('library');
  const settingsFocus = ref<SettingsFocus>(null);

  const isLibrary = computed(() => view.value === 'library');
  const isSettings = computed(() => view.value === 'settings');
  const isHelp = computed(() => view.value === 'help');
  const isPlayer = computed(() => view.value === 'player');

  function go(next: AppView) {
    if (next !== 'settings') {
      settingsFocus.value = null;
    }

    view.value = next;
  }

  function goToSettings(focus: Exclude<SettingsFocus, null> | null = null) {
    settingsFocus.value = focus;
    view.value = 'settings';
  }

  function clearSettingsFocus() {
    settingsFocus.value = null;
  }

  /** Opens a view, or returns to the library when that view is already open. */
  function toggle(target: AppView) {
    const next = view.value === target ? 'library' : target;

    if (next !== 'settings') {
      settingsFocus.value = null;
    }

    view.value = next;
  }

  function toggleSettings() {
    toggle('settings');
  }

  function toggleHelp() {
    toggle('help');
  }

  return {
    view,
    settingsFocus,
    isLibrary,
    isSettings,
    isHelp,
    isPlayer,
    go,
    goToSettings,
    clearSettingsFocus,
    toggle,
    toggleSettings,
    toggleHelp,
  };
});
