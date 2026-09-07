import { describe, expect, it } from 'vitest';

import {
  containedTableColumns,
  isLockedLeadingTableColumn,
  isMandatoryTableColumn,
  normalizeTableColumnOrder,
} from '@/services/table-columns';
import { TABLE_COLUMN_WIDTHS, type TableColumnSetting } from '@/types/settings';

function column(key: TableColumnSetting['key'], width = 100): TableColumnSetting {
  return { key, visible: true, width };
}

describe('isMandatoryTableColumn', () => {
  it('keeps cover, title and duration in the list whatever the settings say', () => {
    expect(isMandatoryTableColumn('cover')).toBe(true);
    expect(isMandatoryTableColumn('title')).toBe(true);
    expect(isMandatoryTableColumn('duration')).toBe(true);
  });

  it('leaves every other column free to be hidden', () => {
    for (const key of ['artist', 'album', 'year', 'genre', 'format', 'path'] as const) {
      expect(isMandatoryTableColumn(key)).toBe(false);
    }
  });
});

describe('isLockedLeadingTableColumn', () => {
  it('pins cover and title to the front', () => {
    expect(isLockedLeadingTableColumn('cover')).toBe(true);
    expect(isLockedLeadingTableColumn('title')).toBe(true);
  });

  it('lets the rest be moved, mandatory or not', () => {
    expect(isLockedLeadingTableColumn('duration')).toBe(false);
    expect(isLockedLeadingTableColumn('genre')).toBe(false);
  });
});

describe('normalizeTableColumnOrder', () => {
  it('brings the pinned columns back to the front, in their own order', () => {
    const order = normalizeTableColumnOrder([column('genre'), column('title'), column('cover')]);

    expect(order.map((item) => item.key)).toEqual(['cover', 'title', 'genre']);
  });

  it('leaves an order that is already right alone', () => {
    const order = normalizeTableColumnOrder([column('cover'), column('title'), column('album')]);

    expect(order.map((item) => item.key)).toEqual(['cover', 'title', 'album']);
  });

  it('keeps the order of everything that is not pinned', () => {
    const order = normalizeTableColumnOrder([
      column('year'),
      column('cover'),
      column('genre'),
      column('album'),
    ]);

    expect(order.map((item) => item.key)).toEqual(['cover', 'year', 'genre', 'album']);
  });

  it('copes with a pinned column that is not there at all', () => {
    const order = normalizeTableColumnOrder([column('album'), column('title')]);

    expect(order.map((item) => item.key)).toEqual(['title', 'album']);
  });

  it('carries the settings of each column through untouched', () => {
    const order = normalizeTableColumnOrder([{ key: 'genre', visible: false, width: 140 }]);

    expect(order[0]).toEqual({ key: 'genre', visible: false, width: 140 });
  });
});

describe('containedTableColumns', () => {
  // Cover, title, artist and album: the room left for the last two is what the table has
  // once the padding, the gaps, the actions, the cover and the narrowest title are taken
  // out of it — 684 - 132 - 56 - 96, that is 400 pixels for the 600 they ask for.
  const columns = [
    column('cover', 56),
    column('title', 260),
    column('artist', 300),
    column('album', 300),
  ];

  it('leaves the widths alone while they fit', () => {
    expect(containedTableColumns(columns, { width: 1400, rem: 16 })).toEqual(columns);
  });

  it('narrows the columns together when they no longer fit', () => {
    const fitted = containedTableColumns(columns, { width: 684, rem: 16 });

    expect(fitted.map((item) => item.width)).toEqual([56, 260, 200, 200]);
  });

  it('never takes a column under its narrowest', () => {
    const fitted = containedTableColumns(columns, { width: 400, rem: 16 });

    expect(fitted.map((item) => item.width)).toEqual([
      56,
      260,
      TABLE_COLUMN_WIDTHS.artist.min,
      TABLE_COLUMN_WIDTHS.album.min,
    ]);
  });

  // The cover is a square as tall as the row and the year is a set number of characters:
  // narrowing either of them would be resizing something other than a column of text.
  it('leaves the cover and the fixed columns as they are', () => {
    const withYear = [...columns, column('year', 72)];
    const fitted = containedTableColumns(withYear, { width: 500, rem: 16 });

    expect(fitted[0]).toEqual(column('cover', 56));
    expect(fitted[4]).toEqual(column('year', 72));
  });

  it('keeps the asked widths while the table has not been measured', () => {
    expect(containedTableColumns(columns, { width: 0, rem: 16 })).toEqual(columns);
  });

  it('answers with a list of its own, leaving the settings untouched', () => {
    const fitted = containedTableColumns(columns, { width: 684, rem: 16 });

    expect(fitted[2]).not.toBe(columns[2]);
    expect(columns[2]?.width).toBe(300);
  });
});
