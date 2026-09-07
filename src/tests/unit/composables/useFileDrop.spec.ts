import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';

import { useFileDrop } from '@/composables/useFileDrop';

const scopedWindow = window as unknown as Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  onDragDropEvent: vi.fn(),
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({ onDragDropEvent: mocks.onDragDropEvent }),
}));

function mountHost(onDrop: (paths: string[]) => void) {
  const Host = defineComponent({
    setup: () => useFileDrop(onDrop),
    template: '<div />',
  });

  return mount(Host);
}

afterEach(() => {
  delete scopedWindow.__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

describe('useFileDrop', () => {
  it('does not register outside the desktop shell', () => {
    mountHost(vi.fn());

    expect(mocks.onDragDropEvent).not.toHaveBeenCalled();
  });

  it('highlights the area while dragging', () => {
    const wrapper = mountHost(vi.fn());

    wrapper.vm.handle({ type: 'enter' });
    expect(wrapper.vm.isDraggingOver).toBe(true);

    wrapper.vm.handle({ type: 'leave' });
    expect(wrapper.vm.isDraggingOver).toBe(false);
  });

  it('forwards all dropped content, including folders', () => {
    const onDrop = vi.fn();
    const wrapper = mountHost(onDrop);

    wrapper.vm.handle({
      type: 'drop',
      paths: ['C:/music/track.mp3', 'C:/music/Album 2020', 'C:/music/altro.FLAC'],
    });

    // Only the backend can look inside a folder, so nothing is filtered out here.
    expect(onDrop).toHaveBeenCalledWith([
      'C:/music/track.mp3',
      'C:/music/Album 2020',
      'C:/music/altro.FLAC',
    ]);
    expect(wrapper.vm.isDraggingOver).toBe(false);
  });

  it('handles a drop event without paths', () => {
    const onDrop = vi.fn();
    const wrapper = mountHost(onDrop);

    wrapper.vm.handle({ type: 'drop' });

    expect(onDrop).toHaveBeenCalledWith([]);
  });

  it('registers on the window inside the desktop shell', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    const unlisten = vi.fn();
    mocks.onDragDropEvent.mockResolvedValue(unlisten);

    const wrapper = mountHost(vi.fn());
    await vi.waitFor(() => expect(mocks.onDragDropEvent).toHaveBeenCalledTimes(1));

    wrapper.unmount();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it('does not break the app if registration fails', async () => {
    scopedWindow.__TAURI_INTERNALS__ = {};
    mocks.onDragDropEvent.mockRejectedValue(new Error('boom'));

    const wrapper = mountHost(vi.fn());
    await vi.waitFor(() => expect(mocks.onDragDropEvent).toHaveBeenCalledTimes(1));

    expect(() => wrapper.unmount()).not.toThrow();
  });
});
