import type { PreviewSize, PreviewSizePage } from '@/types/settings';

/** The page a list of groups is shown on, by the field it groups the library by. */
export const FACET_PAGES: Record<'artist' | 'album' | 'genre', PreviewSizePage> = {
  artist: 'artists',
  album: 'albums',
  genre: 'genres',
};

/**
 * The narrowest a card of the track preview may be, per size.
 *
 * The grid fills the row with as many cards as fit above this floor, so the number that
 * changes here is how many end up on a line — which is what "bigger cards" means to
 * someone looking at a window of a fixed width.
 */
const TRACK_CARD_WIDTHS: Record<PreviewSize, string> = {
  small: '7rem',
  medium: '9rem',
  large: '12rem',
};

/** The same for the cards of artists, albums and genres, which carry more than a title. */
const GROUP_CARD_WIDTHS: Record<PreviewSize, string> = {
  small: '10rem',
  medium: '13rem',
  large: '17rem',
};

export function trackCardWidth(size: PreviewSize): string {
  return TRACK_CARD_WIDTHS[size];
}

export function groupCardWidth(size: PreviewSize): string {
  return GROUP_CARD_WIDTHS[size];
}

/**
 * A genre card is laid out sideways — cover on the left, names on the right — so it starts
 * about twice as wide as the others and keeps a height of its own rather than a square.
 */
const GENRE_CARD_WIDTHS: Record<PreviewSize, string> = {
  small: '20rem',
  medium: '24rem',
  large: '30rem',
};

const GENRE_CARD_HEIGHTS: Record<PreviewSize, string> = {
  small: '7.5rem',
  medium: '9rem',
  large: '11rem',
};

export function genreCardWidth(size: PreviewSize): string {
  return GENRE_CARD_WIDTHS[size];
}

export function genreCardHeight(size: PreviewSize): string {
  return GENRE_CARD_HEIGHTS[size];
}
