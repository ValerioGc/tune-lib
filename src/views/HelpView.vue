<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppIcon from '@/components/common/AppIcon.vue';
import HelpTopicCard from '@/components/help/HelpTopicCard.vue';
import BackToLibrary from '@/components/layout/BackToLibrary.vue';
import { HELP_TOPICS, HELP_TOPIC_ICONS, type HelpTopic } from '@/config/help';

const { t } = useI18n();

/** One topic at a time: the guide is long, and the index says what else is in it. */
const openTopic = ref<HelpTopic>(HELP_TOPICS[0]);
</script>

<template>
  <div class="help_view">
    <BackToLibrary />

    <header class="help_view_header">
      <h1 class="help_view_title">{{ t('help.title') }}</h1>
      <p class="help_view_subtitle">{{ t('help.subtitle') }}</p>
    </header>

    <div class="help_view_body">
      <nav
        class="help_view_index common_glass_lg common_scroll_area_auto"
        :aria-label="t('help.index')"
      >
        <p class="help_view_index_title">{{ t('help.index') }}</p>

        <ul class="help_view_index_list">
          <li v-for="(topic, index) in HELP_TOPICS" :key="topic">
            <button
              class="help_view_index_entry"
              :class="{ help_view_index_entry_active: topic === openTopic }"
              type="button"
              :aria-current="topic === openTopic ? 'true' : undefined"
              :data-testid="`help-index-${topic}`"
              @click="openTopic = topic"
            >
              <span class="help_view_index_number" aria-hidden="true">{{ index + 1 }}</span>
              <AppIcon :name="HELP_TOPIC_ICONS[topic]" />
              <span class="help_view_index_name">{{ t(`help.topics.${topic}.title`) }}</span>
            </button>
          </li>
        </ul>
      </nav>

      <HelpTopicCard
        class="help_view_topic common_scroll_area_auto"
        :topic="openTopic"
        @open="openTopic = $event"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.help_view {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space_lg;
  min-height: 0;
  overflow: hidden;

  @include page_column(64rem);

  &_header {
    display: flex;
    flex-direction: column;
    gap: $space_xs;
    text-align: center;
  }

  &_title {
    font-size: 1.75em;
    font-weight: 600;
  }

  &_subtitle {
    color: var(--color_text_muted);
  }

  // The index stays on the left, where navigation is found before the topic content. The
  // topic receives the flexible column so its explanatory text has room to breathe.
  &_body {
    display: grid;
    flex: 1 1 0;
    grid-template-columns: 15rem minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    gap: $space_lg;
    align-items: stretch;
    min-height: 0;
    overflow: hidden;
    overscroll-behavior: none;
  }

  &_topic {
    min-width: 0;
    min-height: 0;
    max-height: none;

    overscroll-behavior: none;
  }

  &_index {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
    min-height: 0;
    max-height: none;
    padding: $space_md;
    overscroll-behavior: none;
  }

  &_index_title {
    color: var(--color_text_muted);
    font-size: 0.8125em;
    font-weight: 700;
    text-transform: uppercase;
  }

  &_index_list {
    display: flex;
    flex-direction: column;
    gap: $space_2xs;
    margin: 0;
    padding-left: 0;
    list-style: none;
  }

  &_index_entry {
    display: flex;
    gap: $space_sm;
    align-items: center;
    width: 100%;
    padding: $space_xs $space_sm;
    border: 0;
    border-left: 2px solid transparent;
    border-radius: $radius_sm;
    background: none;
    color: var(--color_text_muted);
    font: inherit;
    font-size: 0.9375em;
    text-align: left;
    cursor: pointer;
    transition:
      background-color $duration_fast ease,
      border-color $duration_fast ease,
      color $duration_fast ease;

    &:hover {
      background-color: var(--color_surface_hover);
      color: var(--color_text);
    }

    @include focus_ring;

    :deep(.app_icon) {
      flex-shrink: 0;
      font-size: 1.15em;
    }

    // The open topic is marked on the rail as well as filled: the index is read down its
    // left edge, and a colour alone is easy to lose among fourteen lines.
    &_active {
      border-left-color: var(--color_accent);
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
      font-weight: 600;
    }
  }

  &_index_number {
    flex-shrink: 0;
    width: 1.5rem;
    font-size: 0.8em;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  &_index_name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// Under a narrow window the index goes on top, where it is read before the topic.
@media (max-width: 860px) {
  .help_view_body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  }
}
</style>
