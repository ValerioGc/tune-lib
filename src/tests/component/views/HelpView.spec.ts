import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetI18n, withPinia } from '@tests/support/mount';
import { HELP_TOPICS } from '@/config/help';
import { i18n, setI18nLocale } from '@/i18n';
import { useNavigationStore } from '@/stores/navigation';
import { LOCALES } from '@/types/settings';

import HelpView from '@/views/HelpView.vue';

beforeEach(() => {
  resetI18n();
});

function mountHelp() {
  return mount(HelpView, withPinia());
}

describe('HelpView', () => {
  it('indexes every topic of the guide, and opens the first one', () => {
    const wrapper = mountHelp();

    const entries = wrapper
      .findAll('.help_view_index_entry')
      .map((entry) => entry.attributes('data-testid'));

    expect(entries).toEqual(HELP_TOPICS.map((topic) => `help-index-${topic}`));
    expect(wrapper.get('.help_view_body').element.firstElementChild?.classList).toContain(
      'help_view_index',
    );
    // One topic at a time: the guide is long, and the index says what else is in it.
    expect(wrapper.findAll('.help_topic')).toHaveLength(1);
    expect(wrapper.get('.help_topic').attributes('data-topic')).toBe(HELP_TOPICS[0]);
  });

  it('changes the page from the index', async () => {
    const wrapper = mountHelp();

    await wrapper.get('[data-testid="help-index-dock"]').trigger('click');

    expect(wrapper.get('.help_topic').attributes('data-topic')).toBe('dock');
    expect(wrapper.get('[data-testid="help-index-dock"]').attributes('aria-current')).toBe('true');
  });

  it('states where each topic is and how to use it', async () => {
    const wrapper = mountHelp();

    for (const topic of HELP_TOPICS) {
      await wrapper.get(`[data-testid="help-index-${topic}"]`).trigger('click');
      const card = wrapper.get('.help_topic');

      expect(card.get('.help_topic_title').text().length).toBeGreaterThan(0);
      expect(card.get('.help_topic_context').text()).toContain('Dove:');
      expect(card.findAll('.help_topic_section').length).toBeGreaterThan(0);
      expect(card.get('.help_topic_tip').text()).toContain('Suggerimento');
    }
  });

  it('lists steps in the order written in translations', async () => {
    const wrapper = mountHelp();
    await wrapper.get('[data-testid="help-index-import"]').trigger('click');
    const topic = wrapper.get('.help_topic[data-topic="import"]');

    const steps = topic.findAll('.help_topic_section').map((step) => step.text());

    expect(steps[0]).toContain('Aggiungi brani');
    expect(steps.some((step) => step.includes('Aggiungi cartella'))).toBe(true);
    expect(steps.some((step) => step.includes('trascina'))).toBe(true);
  });

  it('presents procedures as titled sections and highlights useful controls', async () => {
    const wrapper = mountHelp();

    expect(wrapper.find('.help_topic[data-topic="start"] .help_topic_prose').exists()).toBe(true);
    expect(wrapper.findAll('.help_topic_section strong').map((label) => label.text())).toContain(
      'Doppio clic',
    );
    expect(wrapper.find('.help_topic_section .app_icon_settings').exists()).toBe(true);

    await wrapper.get('[data-testid="help-index-import"]').trigger('click');

    expect(wrapper.findAll('.help_topic_section h3')).toHaveLength(3);
    expect(wrapper.find('.help_topic_content ul').exists()).toBe(false);
    expect(wrapper.find('aside.help_topic_tip').exists()).toBe(true);
  });

  it.each(LOCALES)(
    'renders every topic in %s without unresolved rich-text placeholders',
    async (locale) => {
      setI18nLocale(locale);
      const wrapper = mountHelp();

      for (const topic of HELP_TOPICS) {
        await wrapper.get(`[data-testid="help-index-${topic}"]`).trigger('click');
        const article = wrapper.get('.help_topic');
        expect(article.findAll('.help_topic_section h3')).toHaveLength(3);
        expect(article.text()).not.toMatch(/\{\w+\}|help\.topics\.|undefined/);
      }

      await wrapper.get('[data-testid="help-index-player"]').trigger('click');
      expect(wrapper.find('.help_topic_section .app_icon_play').exists()).toBe(true);
      expect(wrapper.find('.help_topic_section .app_icon_pause').exists()).toBe(true);
      await wrapper.get('[data-testid="help-index-shortcuts"]').trigger('click');
      expect(wrapper.findAll('kbd').map((key) => key.text())).toEqual(
        ['ctrl', 'shift', 'esc'].map((key) => i18n.global.t(`help.keys.${key}`)),
      );
    },
  );

  it('translates the whole guide when the language changes', async () => {
    const wrapper = mountHelp();
    await wrapper.get('[data-testid="help-index-import"]').trigger('click');

    setI18nLocale('en');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.help_view_title').text()).toBe('Guide');
    expect(wrapper.get('.help_topic[data-topic="import"] .help_topic_title').text()).toBe(
      'Adding tracks and folders',
    );
    expect(wrapper.get('.help_topic_context').text()).toContain('Where:');
  });

  it('walks the guide from one topic to the next', async () => {
    const wrapper = mountHelp();

    // The first topic has nothing before it, so only the way forward is offered.
    expect(wrapper.find('[data-testid="help-previous-topic"]').exists()).toBe(false);

    await wrapper.get('[data-testid="help-next-topic"]').trigger('click');

    expect(wrapper.get('.help_topic').attributes('data-topic')).toBe(HELP_TOPICS[1]);

    await wrapper.get('[data-testid="help-previous-topic"]').trigger('click');

    expect(wrapper.get('.help_topic').attributes('data-topic')).toBe(HELP_TOPICS[0]);
  });

  it('uses the next-topic glyph for both navigation directions', async () => {
    const wrapper = mountHelp();

    await wrapper.get('[data-testid="help-next-topic"]').trigger('click');

    expect(wrapper.get('[data-testid="help-previous-topic"] .app_icon').classes()).toContain(
      'app_icon_next',
    );
    expect(
      wrapper.get('[data-testid="help-previous-topic"] .help_topic_steer_previous_icon').classes(),
    ).toContain('help_topic_steer_previous_icon');
  });

  it('returns to the library', async () => {
    const wrapper = mountHelp();
    const navigation = useNavigationStore();
    navigation.go('help');

    await wrapper.get('[data-testid="back-to-library"]').trigger('click');

    expect(navigation.view).toBe('library');
  });
});
