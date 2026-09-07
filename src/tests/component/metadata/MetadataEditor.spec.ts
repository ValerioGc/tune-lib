import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import { useLibraryStore } from '@/stores/library';
import type { Cover, TrackView } from '@/types/library';

import CoverPicker from '@/components/metadata/fields/CoverPicker.vue';
import MetadataEditor from '@/components/metadata/MetadataEditor.vue';

beforeEach(() => {
  resetI18n();
});

async function mountEditor(track: TrackView = makeTrack()) {
  const options = withPinia();
  const store = useLibraryStore();
  vi.spyOn(store, 'coverUrl').mockReturnValue(null);
  vi.spyOn(store, 'heavyCoverBytes').mockResolvedValue(null);
  const saveMetadata = vi.spyOn(store, 'saveMetadata').mockResolvedValue(track);
  const saveCover = vi.spyOn(store, 'saveCover').mockResolvedValue(track);

  const wrapper = mount(MetadataEditor, { ...options, props: { track } });
  await flushPromises();

  return { wrapper, store, saveMetadata, saveCover };
}

function fieldAt(wrapper: Awaited<ReturnType<typeof mountEditor>>['wrapper'], index: number) {
  return wrapper.findAll('.metadata_field_input')[index];
}

describe('MetadataEditor', () => {
  it.each([null, { mimeType: 'image/png', data: 'AAA' }])(
    'preserves the pending cover when saving replaces the track object: %s',
    async (cover) => {
      const track = makeTrack({ album: null, hasCover: true });
      const { wrapper, saveMetadata, saveCover } = await mountEditor(track);
      saveMetadata.mockImplementation(async () => {
        const updated = { ...track, title: 'Updated' };
        await wrapper.setProps({ track: updated });
        return updated;
      });
      const picker = wrapper.findComponent(CoverPicker);
      if (cover === null) {
        picker.vm.$emit('remove');
      } else {
        picker.vm.$emit('select', cover);
      }
      await wrapper.get('[data-testid="metadata-save"]').trigger('click');
      await flushPromises();
      expect(saveCover).toHaveBeenCalledWith(track.id, cover);
      expect(wrapper.emitted('close')).toHaveLength(1);
    },
  );

  it('says why the cover of a file is not shown when it is too heavy', async () => {
    const track = makeTrack({ hasCover: true });
    const options = withPinia();
    const store = useLibraryStore();
    vi.spyOn(store, 'coverUrl').mockReturnValue(null);
    vi.spyOn(store, 'heavyCoverBytes').mockResolvedValue(20_000_000);

    const wrapper = mount(MetadataEditor, { ...options, props: { track } });
    await flushPromises();

    expect(wrapper.get('[data-testid="cover-too-large"]').text()).toContain('19,1 MB');
  });

  it('says nothing about the weight when the file simply has no cover', async () => {
    const { wrapper } = await mountEditor(makeTrack({ hasCover: false }));

    expect(wrapper.find('[data-testid="cover-too-large"]').exists()).toBe(false);
  });

  it('prefills fields with track values', async () => {
    const track = makeTrack({
      title: 'Track',
      artist: 'Artist',
      album: 'Album',
      year: 1999,
      genre: 'Jazz',
    });
    const { wrapper } = await mountEditor(track);

    expect((fieldAt(wrapper, 0)?.element as HTMLInputElement).value).toBe('Track');
    expect((fieldAt(wrapper, 1)?.element as HTMLInputElement).value).toBe('Artist');
    expect((fieldAt(wrapper, 2)?.element as HTMLInputElement).value).toBe('Album');
    expect((fieldAt(wrapper, 3)?.element as HTMLInputElement).value).toBe('1999');
    expect((wrapper.get('.genre_select_input').element as HTMLInputElement).value).toBe('Jazz');
  });

  it('offers library metadata suggestions while editing', async () => {
    const { wrapper, store } = await mountEditor();
    store.tracks = [
      makeTrack({ artist: 'Artist A', album: 'Album A', genre: 'Jazz' }),
      makeTrack({ artist: 'Artist B', album: 'Album B', genre: 'Rock' }),
    ];
    await flushPromises();

    expect(wrapper.findAll('.metadata_field datalist')[0]?.findAll('option')).toHaveLength(2);
    expect(
      wrapper
        .findAll('.metadata_field datalist')[1]
        ?.findAll('option')
        .map((option) => option.attributes('value')),
    ).toEqual(['Album A', 'Album B']);
    expect(
      wrapper.findAll('.genre_select option').map((option) => option.attributes('value')),
    ).toEqual(['Jazz', 'Rock']);
  });

  it('leaves missing fields empty', async () => {
    const { wrapper } = await mountEditor(
      makeTrack({ artist: null, album: null, year: null, genre: null }),
    );

    expect((fieldAt(wrapper, 1)?.element as HTMLInputElement).value).toBe('');
    expect((fieldAt(wrapper, 2)?.element as HTMLInputElement).value).toBe('');
    expect((fieldAt(wrapper, 3)?.element as HTMLInputElement).value).toBe('');
  });

  it('blocks saving with an empty title', async () => {
    const { wrapper, saveMetadata } = await mountEditor();

    await fieldAt(wrapper, 0)?.setValue('   ');

    expect(wrapper.get('[data-testid="metadata-save"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[role="alert"]').text()).toContain('vuoto');

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    expect(saveMetadata).not.toHaveBeenCalled();
  });

  it('blocks saving with an implausible year', async () => {
    const { wrapper } = await mountEditor();

    await fieldAt(wrapper, 3)?.setValue('12');

    expect(wrapper.get('[data-testid="metadata-save"]').attributes('disabled')).toBeDefined();
  });

  it('saves edited fields and closes', async () => {
    const track = makeTrack({ title: 'Old', year: 1999 });
    const { wrapper, saveMetadata, saveCover } = await mountEditor(track);

    await fieldAt(wrapper, 0)?.setValue('New title');
    await fieldAt(wrapper, 1)?.setValue('New Artist');
    await fieldAt(wrapper, 3)?.setValue('2001');
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveMetadata).toHaveBeenCalledWith(track.id, {
      title: 'New title',
      artist: 'New Artist',
      album: 'Album',
      year: 2001,
      genre: 'Rock',
    });
    expect(saveCover).not.toHaveBeenCalled();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('clears fields left empty', async () => {
    const { wrapper, saveMetadata } = await mountEditor();

    await fieldAt(wrapper, 1)?.setValue('');
    await fieldAt(wrapper, 2)?.setValue('');
    await fieldAt(wrapper, 3)?.setValue('');
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveMetadata).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ artist: null, album: null, year: null }),
    );
  });

  it('does not touch the cover if the user does not edit it', async () => {
    const { wrapper, saveCover } = await mountEditor();

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveCover).not.toHaveBeenCalled();
  });

  it('saves removal of the existing cover', async () => {
    const track = makeTrack({ hasCover: true });
    const options = withPinia();
    const store = useLibraryStore();
    vi.spyOn(store, 'coverUrl').mockReturnValue('cover://localhost/track.mp3?v=0');
    vi.spyOn(store, 'heavyCoverBytes').mockResolvedValue(null);
    vi.spyOn(store, 'saveMetadata').mockResolvedValue(track);
    const saveCover = vi.spyOn(store, 'saveCover').mockResolvedValue(track);

    const wrapper = mount(MetadataEditor, { ...options, props: { track } });
    await flushPromises();

    await wrapper.findAll('.cover_picker_actions button')[1]?.trigger('click');
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(saveCover).toHaveBeenCalledWith(track.id, null);
  });

  it.each([null, { mimeType: 'image/png', data: 'AAA' }])(
    'asks before applying a cover change to the whole album: %s',
    async (cover) => {
      const track = makeTrack({ id: 'track-1', album: 'Album', artist: 'Artist' });
      const sibling = makeTrack({ id: 'track-2', album: ' album ', artist: 'Artist' });
      const other = makeTrack({ id: 'track-3', album: 'Other', artist: 'Artist' });
      const { wrapper, store, saveCover } = await mountEditor(track);
      store.tracks = [track, sibling, other];

      if (cover === null) {
        wrapper.findComponent(CoverPicker).vm.$emit('remove');
      } else {
        wrapper.findComponent(CoverPicker).vm.$emit('select', cover);
      }
      await wrapper.get('[data-testid="metadata-save"]').trigger('click');
      await flushPromises();

      expect(saveCover).not.toHaveBeenCalled();
      expect(wrapper.get('[data-testid="cover-batch-confirm"]').text()).toContain("Tutto l'album");

      await wrapper.get('[data-testid="cover-batch-confirm"]').trigger('click');
      await flushPromises();

      expect(saveCover).toHaveBeenCalledTimes(2);
      expect(saveCover).toHaveBeenNthCalledWith(1, track.id, cover);
      expect(saveCover).toHaveBeenNthCalledWith(2, sibling.id, cover);
      expect(saveCover).not.toHaveBeenCalledWith(other.id, cover);
      expect(wrapper.emitted('close')).toHaveLength(1);
    },
  );

  it('can keep a selected album cover change on the current track only', async () => {
    const track = makeTrack({ id: 'track-1', album: 'Album' });
    const sibling = makeTrack({ id: 'track-2', album: 'Album' });
    const { wrapper, store, saveCover } = await mountEditor(track);
    const cover: Cover = { mimeType: 'image/jpeg', data: 'BBB' };
    store.tracks = [track, sibling];

    wrapper.findComponent(CoverPicker).vm.$emit('select', cover);
    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="cover-batch-current"]').trigger('click');
    await flushPromises();

    expect(saveCover).toHaveBeenCalledOnce();
    expect(saveCover).toHaveBeenCalledWith(track.id, cover);
    expect(saveCover).not.toHaveBeenCalledWith(sibling.id, cover);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('does not close if saving fails', async () => {
    const { wrapper, store } = await mountEditor();
    vi.spyOn(store, 'saveMetadata').mockResolvedValue(null);

    await wrapper.get('[data-testid="metadata-save"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('requests close from the Cancel button', async () => {
    const { wrapper } = await mountEditor();

    await wrapper.get('.app_modal_actions button').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
