import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';

import BulkMetadataEditor from '@/components/metadata/BulkMetadataEditor.vue';

beforeEach(() => {
  resetI18n();
});

describe('BulkMetadataEditor', () => {
  it('applies only enabled fields to every selected track', async () => {
    const tracks = [
      makeTrack({ id: 'one', title: 'One', artist: 'Old A', year: 1999 }),
      makeTrack({ id: 'two', title: 'Two', artist: 'Old B', year: 2000 }),
    ];
    const options = withPinia();
    const store = useLibraryStore();
    const saveMetadata = vi.spyOn(store, 'saveMetadata').mockImplementation(async (id, update) => ({
      ...tracks.find((track) => track.id === id)!,
      ...update,
    }));
    vi.spyOn(store, 'saveCover').mockResolvedValue(tracks[0]!);

    const wrapper = mount(BulkMetadataEditor, { ...options, props: { tracks } });

    expect(wrapper.find('.metadata_field_input').exists()).toBe(false);
    await wrapper.get('[data-testid="bulk-enable-artist"]').setValue(true);
    await wrapper.get('[data-testid="bulk-enable-year"]').setValue(true);
    await wrapper.findAll('.metadata_field_input')[0]?.setValue('New Artist');
    await wrapper.findAll('.metadata_field_input')[1]?.setValue('2022');
    await wrapper.get('[data-testid="bulk-metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveMetadata).toHaveBeenCalledTimes(2);
    expect(saveMetadata).toHaveBeenNthCalledWith(1, 'one', {
      title: 'One',
      artist: 'New Artist',
      album: 'Album',
      year: 2022,
      genre: 'Rock',
    });
    expect(saveMetadata).toHaveBeenNthCalledWith(2, 'two', {
      title: 'Two',
      artist: 'New Artist',
      album: 'Album',
      year: 2022,
      genre: 'Rock',
    });
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('requires at least one enabled change', () => {
    const wrapper = mount(BulkMetadataEditor, {
      ...withPinia(),
      props: { tracks: [makeTrack(), makeTrack()] },
    });

    expect(wrapper.get('[data-testid="bulk-metadata-save"]').attributes('disabled')).toBeDefined();
  });
});
