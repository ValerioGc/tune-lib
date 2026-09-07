import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useLibraryStore } from '@/stores/library';
import { useNavigationStore } from '@/stores/navigation';
import { useSettingsStore } from '@/stores/settings';

import SettingsView from '@/views/SettingsView.vue';

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  localStorage.clear();
});

describe('SettingsView', () => {
  it('opens on the general settings, then appearance and library', () => {
    const wrapper = mount(SettingsView, withPinia());

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'Generale',
      'Aspetto',
      'Libreria',
    ]);
  });

  it('focuses the Player section when navigation asks for it', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    const wrapper = mount(SettingsView, options);

    navigation.goToSettings('player');
    await flushPromises();

    expect(wrapper.find('[data-testid="settings-player-section"]').exists()).toBe(true);
    expect(navigation.settingsFocus).toBeNull();
  });

  it('groups general application settings under their tab', () => {
    const wrapper = mount(SettingsView, withPinia());

    const titles = wrapper.findAll('.settings_section_title').map((title) => title.text());

    expect(titles).toEqual([
      'Lingua',
      'Avvio e finestra',
      'Player',
      'Messaggi della libreria',
      'Player audio predefinito',
    ]);
  });

  it('groups appearance settings with application and audio player dividers', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.findAll('.settings_view_divider').map((divider) => divider.text())).toEqual([
      'Applicazione',
      'Player audio',
    ]);
    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).toEqual([
      'Dimensione testo',
      'Tema',
      'Colore accent',
      'Sfondo ed effetto vetro',
      'Elenco brani',
      'Colore sfondo da copertina',
    ]);
  });

  it('does not show rename in the library tab', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');

    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).not.toContain(
      'Nome della libreria',
    );
    expect(wrapper.find('.library_name_form').exists()).toBe(false);
  });

  it('shows the library list in its own tab, the last of the three', async () => {
    const wrapper = mount(SettingsView, withPinia());

    await wrapper.findAll('[role="tab"]')[2]?.trigger('click');

    // Creating one sits in the same section as the list it feeds.
    expect(wrapper.findAll('.settings_section_title').map((titolo) => titolo.text())).toEqual([
      'Import / Export',
      'Librerie',
      'Cache delle copertine',
    ]);
    expect(wrapper.find('.library_create_form').exists()).toBe(true);
    expect(wrapper.find('.import_export_panel').exists()).toBe(true);
    expect(wrapper.find('.library_list').exists()).toBe(true);
    expect(wrapper.find('.cover_cache_panel').exists()).toBe(true);
  });

  it('leaves name, version and links to the about window', () => {
    const wrapper = mount(SettingsView, withPinia());

    // The app names itself in the default player section; what left is the block of
    // version and links, which the about window now owns.
    expect(wrapper.find('.settings_app_info_name').exists()).toBe(false);
    expect(wrapper.find('[data-testid="github-link"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="website-link"]').exists()).toBe(false);
  });

  it('translates tabs and sections when the language changes', async () => {
    const wrapper = mount(SettingsView, withPinia());
    const store = useSettingsStore();

    await store.setLocale('en');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.settings_view_title').text()).toBe('Settings');
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      'General',
      'Appearance',
      'Library',
    ]);
    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).toEqual([
      'Language',
      'Startup and window',
      'Player',
      'Library messages',
      'Default audio player',
    ]);

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click');

    expect(wrapper.findAll('.settings_section_title').map((title) => title.text())).toEqual([
      'Text size',
      'Theme',
      'Accent colour',
      'Background and glass',
      'Track list',
      'Background colour from the cover',
    ]);
  });

  it('returns to the library', async () => {
    const options = withPinia();
    const navigation = useNavigationStore();
    navigation.go('settings');
    const wrapper = mount(SettingsView, options);

    await wrapper.get('[data-testid="back-to-library"]').trigger('click');

    expect(navigation.view).toBe('library');
  });

  it('locks the whole page while a library import runs', async () => {
    const options = withPinia();
    const library = useLibraryStore();
    const wrapper = mount(SettingsView, options);
    const page = wrapper.get('[data-testid="settings-page"]');

    expect(page.attributes('disabled')).toBeUndefined();

    library.isLibraryImporting = true;
    await wrapper.vm.$nextTick();

    // One fieldset over the page: the way back, the tabs and every command go down with it.
    expect(page.attributes('disabled')).toBeDefined();
    expect(page.attributes('aria-busy')).toBe('true');
    expect(wrapper.get('[data-testid="back-to-library"]').attributes('disabled')).toBeUndefined();

    library.isLibraryImporting = false;
    await wrapper.vm.$nextTick();

    expect(page.attributes('disabled')).toBeUndefined();
  });
});
