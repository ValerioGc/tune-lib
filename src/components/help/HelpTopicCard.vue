<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import HelpFigure from '@/components/help/HelpFigure.vue';
import HelpText from '@/components/help/HelpText.vue';
import { HELP_TOPICS, HELP_TOPIC_ICONS, type HelpTopic } from '@/config/help';

const props = defineProps<{ topic: HelpTopic }>();

const emit = defineEmits<{ open: [topic: HelpTopic] }>();

const { t, tm } = useI18n();

const icon = computed(() => HELP_TOPIC_ICONS[props.topic]);
const position = computed(() => HELP_TOPICS.indexOf(props.topic) + 1);
const sections = computed(() => tm(`help.topics.${props.topic}.sections`) as unknown[]);

const previous = computed(() => HELP_TOPICS[position.value - 2] ?? null);
const next = computed(() => HELP_TOPICS[position.value] ?? null);
</script>

<template>
  <article class="help_topic common_glass_lg" :data-topic="topic">
    <header class="help_topic_header">
      <span class="help_topic_icon" aria-hidden="true">
        <AppIcon :name="icon" />
      </span>

      <div class="help_topic_headings">
        <p class="help_topic_position">
          {{ t('help.position', { index: position, total: HELP_TOPICS.length }) }}
        </p>
        <h2 class="help_topic_title">{{ t(`help.topics.${topic}.title`) }}</h2>
      </div>
    </header>

    <div class="help_topic_content">
      <div class="help_topic_context">
        <AppIcon name="search" />
        <p>
          <span class="help_topic_label">{{ t('help.where') }}</span>
          <HelpText :path="`help.topics.${topic}.where`" />
        </p>
      </div>

      <HelpFigure :topic="topic" />

      <div class="help_topic_sections help_topic_prose">
        <section
          v-for="(_, index) in sections"
          :key="`${topic}-${index}`"
          class="help_topic_section"
        >
          <h3 class="help_topic_section_title">
            {{ t(`help.topics.${topic}.sections.${index}.title`) }}
          </h3>
          <p><HelpText :path="`help.topics.${topic}.sections.${index}.text`" /></p>
        </section>
      </div>
    </div>

    <aside class="help_topic_tip">
      <AppIcon name="info" />
      <span>
        <strong class="help_topic_label">{{ t('help.tip') }}</strong>
        <HelpText :path="`help.topics.${topic}.tip`" />
      </span>
    </aside>

    <nav class="help_topic_steer" :aria-label="t('help.index')">
      <button
        v-if="previous !== null"
        class="help_topic_steer_button"
        type="button"
        data-testid="help-previous-topic"
        @click="emit('open', previous)"
      >
        <AppIcon class="help_topic_steer_previous_icon" name="next" />
        <span>{{ t(`help.topics.${previous}.title`) }}</span>
      </button>
      <span v-else />

      <button
        v-if="next !== null"
        class="help_topic_steer_button help_topic_steer_button_next"
        type="button"
        data-testid="help-next-topic"
        @click="emit('open', next)"
      >
        <span>{{ t(`help.topics.${next}.title`) }}</span>
        <AppIcon name="next" />
      </button>
    </nav>
  </article>
</template>

<style scoped lang="scss">
.help_topic {
  display: flex;
  flex-direction: column;
  gap: $space_md;
  padding: $space_lg;
  box-shadow: var(--shadow_card);

  &_header {
    display: flex;
    gap: $space_md;
    align-items: center;
    padding-bottom: $space_md;
    border-bottom: 1px solid var(--color_border);
  }

  &_icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background-color: var(--color_accent_soft);
    color: var(--color_accent);
    font-size: 1.25em;
  }

  &_headings {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    min-width: 0;
  }

  &_position {
    color: var(--color_text_muted);
    font-size: 0.6875em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &_title {
    font-size: 1.25em;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  &_content {
    display: flex;
    flex-direction: column;
    gap: $space_md;
  }

  &_context {
    display: flex;
    gap: $space_sm;
    align-items: flex-start;
    padding-bottom: $space_sm;
    border-bottom: 1px solid var(--color_border);
    color: var(--color_text_muted);
    font-size: 0.9375em;

    :deep(.app_icon) {
      flex-shrink: 0;
      color: var(--color_accent);
    }

    p {
      min-width: 0;
    }
  }

  &_label {
    margin-right: $space_xs;
    color: var(--color_text);
    font-weight: 600;
  }

  &_sections {
    margin: 0;
    max-width: 72ch;
  }

  &_prose {
    display: grid;
    gap: $space_lg;
  }

  &_section {
    margin: 0;
    line-height: 1.6;

    &_title {
      margin-bottom: $space_xs;
      color: var(--color_text);
      font-size: 1em;
      font-weight: 600;
    }
  }

  &_tip {
    display: flex;
    gap: $space_sm;
    align-items: flex-start;
    max-width: 72ch;
    padding: $space_md;
    border: 1px solid var(--color_border);
    border-radius: $radius_md;
    background-color: var(--color_accent_soft);
    color: var(--color_text_muted);
    font-size: 0.9375em;
    line-height: 1.6;

    .help_topic_label {
      display: block;
      margin-bottom: $space_2xs;
    }

    :deep(.app_icon) {
      flex-shrink: 0;
      color: var(--color_accent);
    }
  }

  &_steer {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    padding-top: $space_md;
    border-top: 1px solid var(--color_border);

    &_previous_icon {
      transform: rotate(180deg);
    }

    &_button {
      display: inline-flex;
      gap: $space_xs;
      align-items: center;
      max-width: 48%;
      padding: $space_xs $space_sm;
      border: 1px solid var(--color_border);
      border-radius: 999px;
      background: none;
      color: var(--color_text_muted);
      font: inherit;
      font-size: 0.8125em;
      cursor: pointer;
      transition:
        border-color $duration_fast ease,
        background-color $duration_fast ease,
        color $duration_fast ease;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &:hover {
        border-color: var(--color_accent);
        background-color: var(--color_accent_soft);
        color: var(--color_accent);
      }

      @include focus_ring;

      &_next {
        margin-left: auto;
      }
    }
  }
}
</style>
