import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTracks } from '@tests/support/tracks';

import { useLibraryStore } from '@/stores/library';

import LibraryToolbar from '@/components/library/header/LibraryToolbar.vue';

beforeEach(() => {
  resetI18n();
});

describe('LibraryToolbar', () => {
  it('opens the system dialog from the unified add menu', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    const pickAndAdd = vi.spyOn(store, 'pickAndAdd').mockResolvedValue(null);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('[data-testid="library-import-open"]').trigger('click');
    await wrapper.findAll('.library_import_button_item')[0]?.trigger('click');

    expect(pickAndAdd).toHaveBeenCalledTimes(1);
  });

  it('opens the folder dialog from the unified add menu', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    const pickFoldersAndAdd = vi.spyOn(store, 'pickFoldersAndAdd').mockResolvedValue(null);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('[data-testid="library-import-open"]').trigger('click');
    await wrapper.findAll('.library_import_button_item')[1]?.trigger('click');

    expect(pickFoldersAndAdd).toHaveBeenCalledTimes(1);
  });

  it('blocca il pulsante durante l import', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.isImporting = true;

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="library-import-open"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="library-import-open"]').text()).toContain(
      'Importazione in corso…',
    );
  });

  it('leaves the count of the import to the central progress', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.isImporting = true;

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.vm.$nextTick();

    // Nothing to count yet: the folders are still being walked.
    expect(wrapper.get('[data-testid="library-import-open"]').text()).toContain(
      'Importazione in corso',
    );

    store.importProgress = { done: 3, total: 8 };
    await wrapper.vm.$nextTick();

    // How far the import has got is said once, in the placeholder that replaces the list.
    expect(wrapper.get('[data-testid="library-import-open"]').text()).not.toContain('%');
  });

  it('updates search in the store', async () => {
    const options = withPinia();
    const store = useLibraryStore();
    store.tracks = makeTracks(1);

    const wrapper = mount(LibraryToolbar, options);
    await wrapper.get('input').setValue('rock');

    expect(store.query).toBe('rock');
  });

  it('keeps the missing information filter out of the toolbar', () => {
    const wrapper = mount(LibraryToolbar, withPinia());

    expect(wrapper.find('select').exists()).toBe(false);
  });

  it('offers batch editing only for multiple selected tracks', async () => {
    const wrapper = mount(LibraryToolbar, { ...withPinia(), props: { selectedCount: 2 } });

    await wrapper.get('[data-testid="bulk-edit-open"]').trigger('click');

    expect(wrapper.emitted('editSelected')).toHaveLength(1);
  });

  it('turns off everything but the import while the library is empty', async () => {
    const options = withPinia();
    const library = useLibraryStore();

    const wrapper = mount(LibraryToolbar, {
      ...options,
      props: { showSort: true, previewSizePage: 'tracks' as const },
    });

    expect(wrapper.get('input').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="preview-sort-field"]').attributes('disabled')).toBeDefined();
    expect(
      wrapper.get('[data-testid="preview-sort-direction"]').attributes('disabled'),
    ).toBeDefined();
    expect(wrapper.get('[data-testid="preview-size-medium"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="view-table"]').attributes('disabled')).toBeDefined();
    // Hovering a control that does nothing must not offer to explain what it does.
    await wrapper.get('[data-testid="preview-sort-direction"]').trigger('mouseenter');
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    // The one way out of an empty library stays open.
    expect(
      wrapper.get('[data-testid="library-import-open"]').attributes('disabled'),
    ).toBeUndefined();

    library.tracks = makeTracks(1);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('input').attributes('disabled')).toBeUndefined();
    expect(
      wrapper.get('[data-testid="preview-sort-field"]').attributes('disabled'),
    ).toBeUndefined();
    expect(wrapper.get('[data-testid="view-table"]').attributes('disabled')).toBeUndefined();
  });

  it('offers the sort only where there are no column headers', async () => {
    const options = withPinia();
    const library = useLibraryStore();
    library.tracks = makeTracks(1);
    const wrapper = mount(LibraryToolbar, options);

    expect(wrapper.find('[data-testid="preview-sort-field"]').exists()).toBe(false);

    await wrapper.setProps({ showSort: true });

    await wrapper.get('[data-testid="preview-sort-field"]').trigger('click');
    await wrapper.get('[data-testid="preview-sort-option-album"]').trigger('click');
    expect(library.sort).toEqual({ column: 'album', direction: 'asc' });

    await wrapper.get('[data-testid="preview-sort-direction"]').trigger('click');
    expect(library.sort).toEqual({ column: 'album', direction: 'desc' });
  });
});
