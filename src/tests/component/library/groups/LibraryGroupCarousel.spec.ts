import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { makeTrack } from '@tests/support/tracks';
import LibraryGroupCarousel, {
  type CarouselGroup,
} from '@/components/library/groups/LibraryGroupCarousel.vue';

beforeEach(() => {
  resetI18n();
});

const groups: CarouselGroup[] = [
  {
    key: 'First Album',
    name: 'First Album',
    meta: '1999',
    coverTrack: makeTrack({ title: 'Blue', hasCover: true }),
    playing: false,
  },
  { key: 'Second Album', name: 'Second Album', meta: null, coverTrack: null, playing: true },
];

function mountCarousel(props: Partial<InstanceType<typeof LibraryGroupCarousel>['$props']> = {}) {
  return mount(LibraryGroupCarousel, {
    ...withPinia(),
    props: {
      title: 'Album',
      groups,
      ...props,
    },
  });
}

describe('LibraryGroupCarousel', () => {
  it('shows one card per group, with its name and meta line', () => {
    const cards = mountCarousel().findAll('.library_group_carousel_card');

    expect(cards).toHaveLength(2);
    expect(cards[0]?.text()).toContain('First Album');
    expect(cards[0]?.text()).toContain('1999');
    expect(cards[1]?.text()).toContain('Second Album');
  });

  it('keeps the meta line even when empty, so the cards stand level', () => {
    const cards = mountCarousel().findAll('.library_group_carousel_card');

    expect(cards[0]?.get('.library_group_carousel_meta').text()).toBe('1999');
    // A group without a year keeps the line: without it the card would be shorter.
    expect(cards[1]?.get('.library_group_carousel_meta').text()).toBe('');
  });

  it('marks the group that holds the playing track', () => {
    const cards = mountCarousel().findAll('.library_group_carousel_card');

    expect(cards[1]?.classes()).toContain('library_group_carousel_card_playing');
    expect(cards[1]?.attributes('aria-current')).toBe('true');
    expect(cards[1]?.get('[data-testid="playing-bubble"]').attributes('title')).toBe(
      'In riproduzione',
    );
    expect(cards[1]?.text()).not.toContain('In riproduzione');
    expect(cards[0]?.find('[data-testid="playing-bubble"]').exists()).toBe(false);
    expect(cards[0]?.attributes('aria-current')).toBeUndefined();
  });

  it('reports which group was opened, by key', async () => {
    const wrapper = mountCarousel();

    await wrapper.findAll('.library_group_carousel_card')[1]?.trigger('click');

    expect(wrapper.emitted('open')).toEqual([['Second Album']]);
  });

  it('is a strip of cards and nothing else: no command in its header', () => {
    const wrapper = mountCarousel();

    expect(wrapper.get('.library_group_carousel_title').text()).toBe('Album');
    expect(wrapper.find('[data-testid="carousel-action"]').exists()).toBe(false);
    expect(wrapper.find('button.library_group_carousel_action').exists()).toBe(false);
  });

  it('keeps the square of a group without a cover, so the cards line up', () => {
    const cards = mountCarousel().findAll('.library_group_carousel_card');

    expect(cards[0]?.find('.cover_image_card').exists()).toBe(true);
    expect(cards[1]?.find('.cover_image_card').exists()).toBe(false);
    expect(cards[1]?.get('.library_group_carousel_empty').classes()).toContain(
      'library_group_carousel_cover',
    );
  });
});
