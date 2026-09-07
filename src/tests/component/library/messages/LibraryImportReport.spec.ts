import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import type { AddReport } from '@/types/library';

import LibraryImportReport from '@/components/library/messages/LibraryImportReport.vue';

beforeEach(() => {
  resetI18n();
});

function mountReport(report: Partial<AddReport>) {
  return mount(LibraryImportReport, {
    ...withPinia(),
    props: { report: { added: [], duplicates: [], failed: [], ...report } },
  });
}

describe('LibraryImportReport', () => {
  it('does not appear when there is nothing to report', () => {
    const wrapper = mountReport({});

    expect(wrapper.find('[data-testid="import-report"]').exists()).toBe(false);
  });

  it('reports added tracks with the correct plural', () => {
    const wrapper = mountReport({ added: [makeTrack(), makeTrack()] });

    expect(wrapper.get('[data-testid="report-added"]').text()).toBe('2 brani aggiunti');
  });

  it('reports duplicates in singular', () => {
    const wrapper = mountReport({ duplicates: ['C:/music/track.mp3'] });

    expect(wrapper.get('[data-testid="report-duplicates"]').text()).toBe('1 file già in libreria');
  });

  it('lists files not imported with the reason', () => {
    const wrapper = mountReport({
      failed: [{ path: 'C:/music/rotto.mp3', reason: 'unreadable audio file' }],
    });

    expect(wrapper.get('[data-testid="report-failed"]').text()).toBe('1 file non importato');
    expect(wrapper.get('.library_report_failures').text()).toContain('unreadable audio file');
    expect(wrapper.get('.library_report_failures').text()).toContain('rotto.mp3');
  });

  it('shows only items with at least one element', () => {
    const wrapper = mountReport({ added: [makeTrack()] });

    expect(wrapper.find('[data-testid="report-added"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="report-duplicates"]').exists()).toBe(false);
  });

  it('requests close', async () => {
    const wrapper = mountReport({ added: [makeTrack()] });

    await wrapper.get('button').trigger('click');

    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});
