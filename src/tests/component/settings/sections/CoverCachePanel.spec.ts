import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';

import CoverCachePanel from '@/components/settings/sections/CoverCachePanel.vue';

const mocks = vi.hoisted(() => ({
  coverCacheSize: vi.fn(),
  clearCoverCache: vi.fn(),
}));

vi.mock('@/services/library-api', () => ({
  coverCacheSize: mocks.coverCacheSize,
  clearCoverCache: mocks.clearCoverCache,
}));

const MEGABYTE = 1024 * 1024;

beforeEach(() => {
  resetI18n();
  mocks.coverCacheSize.mockReset();
  mocks.clearCoverCache.mockReset();
  mocks.coverCacheSize.mockResolvedValue({ bytes: 3 * MEGABYTE, limitBytes: 256 * MEGABYTE });
  mocks.clearCoverCache.mockResolvedValue({ bytes: 0, limitBytes: 256 * MEGABYTE });
});

async function mountPanel() {
  const wrapper = mount(CoverCachePanel, { ...withPinia(), attachTo: document.body });
  await flushPromises();

  return wrapper;
}

/** The command asks before it acts, so every emptying goes through the dialog. */
async function confirmClear(wrapper: Awaited<ReturnType<typeof mountPanel>>) {
  await wrapper.get('[data-testid="clear-cover-cache"]').trigger('click');
  document.querySelector<HTMLButtonElement>('[data-testid="confirm-clear-cover-cache"]')?.click();
  await flushPromises();
}

describe('CoverCachePanel', () => {
  it('shows what the cache weighs and the limit it is kept under', async () => {
    const wrapper = await mountPanel();

    expect(wrapper.get('[data-testid="cover-cache-size"]').text()).toContain('3,0 MB');
    expect(wrapper.text()).toContain('256,0 MB');
  });

  it('asks before emptying the cache, and does nothing until the answer is yes', async () => {
    const wrapper = await mountPanel();

    await wrapper.get('[data-testid="clear-cover-cache"]').trigger('click');

    expect(mocks.clearCoverCache).not.toHaveBeenCalled();

    document.querySelector<HTMLButtonElement>('[data-testid="cancel-clear-cover-cache"]')?.click();
    await flushPromises();

    expect(mocks.clearCoverCache).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="cover-cache-size"]').text()).toContain('3,0 MB');

    wrapper.unmount();
  });

  it('empties the cache and says so', async () => {
    const wrapper = await mountPanel();

    await confirmClear(wrapper);

    expect(mocks.clearCoverCache).toHaveBeenCalled();
    expect(wrapper.get('[data-testid="cover-cache-size"]').text()).toContain('0 MB');
    expect(wrapper.get('[data-testid="cover-cache-status"]').text()).toContain('svuotata');

    wrapper.unmount();
  });

  it('holds the room for its answer, so nothing moves when one arrives', async () => {
    const wrapper = await mountPanel();

    // The line is in the document before the command is given, empty of any text.
    const status = wrapper.get('[data-testid="cover-cache-status"]');

    expect(status.text()).toBe('');
    expect(status.classes()).not.toContain('cover_cache_panel_status_on');

    await confirmClear(wrapper);

    expect(status.classes()).toContain('cover_cache_panel_status_on');

    wrapper.unmount();
  });

  it('reports a failure instead of claiming the cache was emptied', async () => {
    mocks.clearCoverCache.mockRejectedValue(new Error('shell-unavailable'));

    const wrapper = await mountPanel();
    await confirmClear(wrapper);

    const status = wrapper.get('[data-testid="cover-cache-status"]');

    expect(status.classes()).toContain('cover_cache_panel_status_failed');
    expect(status.text()).toContain('Non è stato possibile');

    wrapper.unmount();
  });

  it('offers nothing to empty when there is nothing cached', async () => {
    mocks.coverCacheSize.mockResolvedValue({ bytes: 0, limitBytes: 256 * MEGABYTE });

    const wrapper = await mountPanel();

    expect(wrapper.get('[data-testid="clear-cover-cache"]').attributes('disabled')).toBeDefined();
  });

  it('says nothing rather than a wrong number when the size cannot be read', async () => {
    mocks.coverCacheSize.mockRejectedValue(new Error('shell-unavailable'));

    const wrapper = await mountPanel();

    expect(wrapper.get('[data-testid="cover-cache-size"]').text()).toContain('0 MB');
    // Without a limit from the shell there is no figure to quote for it.
    expect(wrapper.find('.cover_cache_panel_hint').exists()).toBe(false);
  });
});
