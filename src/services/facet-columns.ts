/** What the library can be grouped by. */
export type FacetField = 'artist' | 'album' | 'genre';

/** The columns a list of groups shows, in the order the rows lay them out. */
export type FacetSortColumn = 'name' | 'artist' | 'artists' | 'albums' | 'tracks' | 'duration';

export interface FacetSort {
  column: FacetSortColumn;
  direction: 'asc' | 'desc';
}

export const DEFAULT_FACET_SORT: FacetSort = { column: 'name', direction: 'asc' };

/**
 * The columns of one grouping, each with the key its label is translated under.
 *
 * Shared rather than kept in the list: the control that sorts it sits in the toolbar at
 * the top of the page, and the toolbar has to name the same columns the rows show.
 */
export function facetSortColumns(
  field: FacetField,
): { key: FacetSortColumn; labelKey: string; sortLabelKey?: string }[] {
  return [
    // In a table the first column is headed by what it holds — Album, Autore, Genere. In a
    // list of things to sort by, all three are the name of the card: what else would it be?
    {
      key: 'name',
      labelKey: `library.groups.columns.${field}`,
      sortLabelKey: 'library.columns.title',
    },
    ...(field === 'album'
      ? [{ key: 'artist' as const, labelKey: 'library.groups.columns.artist' }]
      : []),
    ...(field === 'genre'
      ? [{ key: 'artists' as const, labelKey: 'library.groups.columns.artists' }]
      : []),
    ...(field === 'artist' || field === 'genre'
      ? [{ key: 'albums' as const, labelKey: 'library.groups.columns.albums' }]
      : []),
    { key: 'tracks', labelKey: 'library.groups.columns.tracks' },
    { key: 'duration', labelKey: 'library.groups.columns.duration' },
  ];
}
