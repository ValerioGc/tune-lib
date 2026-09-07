import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { useLibraryStore } from '@/stores/library';

import LibraryTrackListExportDialog from '@/components/library/dialogs/LibraryTrackListExportDialog.vue';

const wrappers: VueWrapper[] = [];

beforeEach(() => {
  resetI18n();
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

function mountDialog() {
  const options = withPinia();
  const library = useLibraryStore();
  const wrapper = mount(LibraryTrackListExportDialog, {
    ...options,
    props: { open: true },
    attachTo: document.body,
  });
  wrappers.push(wrapper);

  return { wrapper, library };
}

describe('LibraryTrackListExportDialog', () => {
  it('shows exportable format and fields', () => {
    mountDialog();

    expect(document.body.textContent).toContain('Esporta elenco brani');
    expect(document.body.textContent).toContain('Formato');
    expect(document.body.textContent).toContain('Nome');
    expect(document.body.textContent).toContain('File mancante');
  });

  it('leaves the file path out until it is asked for', async () => {
    const { wrapper, library } = mountDialog();
    const exportTrackList = vi.spyOn(library, 'exportTrackList').mockResolvedValue(true);

    await wrapper.get('[data-testid="track-list-export-submit"]').trigger('click');

    expect(exportTrackList).toHaveBeenCalledWith('csv', expect.not.arrayContaining(['path']));
  });

  it('exports the file path once it is ticked', async () => {
    const { wrapper, library } = mountDialog();
    const exportTrackList = vi.spyOn(library, 'exportTrackList').mockResolvedValue(true);
    const path = wrapper
      .findAll('label')
      .find((label) => label.text().includes('Percorso'))
      ?.find('input[type="checkbox"]');

    await path?.setValue(true);
    await wrapper.get('[data-testid="track-list-export-submit"]').trigger('click');

    expect(exportTrackList).toHaveBeenCalledWith('csv', expect.arrayContaining(['path']));
  });

  it('exports with the selected format and fields', async () => {
    const { wrapper, library } = mountDialog();
    const exportTrackList = vi.spyOn(library, 'exportTrackList').mockResolvedValue(true);

    await wrapper.get('select').setValue('txt');
    await wrapper.findAll('input[type="checkbox"]')[1]?.setValue(false);
    await wrapper.get('[data-testid="track-list-export-submit"]').trigger('click');

    expect(exportTrackList).toHaveBeenCalledWith('txt', expect.not.arrayContaining(['artist']));
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('does not allow exporting without fields', async () => {
    const { wrapper } = mountDialog();

    for (const checkbox of wrapper.findAll('input[type="checkbox"]')) {
      await checkbox.setValue(false);
    }

    expect(
      wrapper.get('[data-testid="track-list-export-submit"]').attributes('disabled'),
    ).toBeDefined();
  });
});
