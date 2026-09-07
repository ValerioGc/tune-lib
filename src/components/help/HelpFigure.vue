<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { HELP_TOPIC_FIGURES, type HelpTopic } from '@/config/help';

const props = defineProps<{ topic: HelpTopic }>();

/** Shaft and head of the arrow, pointing right; the tip is the right edge of the box. */
const ARROW_PATH = 'M6 20 H80 M80 20 L58 6 M80 20 L58 34';

const { t, te } = useI18n();

const shots = import.meta.glob<string>('@/assets/help/*.png', {
  eager: true,
  import: 'default',
});

const figure = computed(() => HELP_TOPIC_FIGURES[props.topic] ?? null);

const source = computed(() => {
  const spec = figure.value;

  if (spec === null) {
    return null;
  }

  const entry = Object.entries(shots).find(([path]) => path.endsWith(`/${spec.file}`));

  return entry?.[1] ?? null;
});

const captionKey = computed(() => `help.topics.${props.topic}.figure`);
const caption = computed(() => (te(captionKey.value) ? t(captionKey.value) : ''));
</script>

<template>
  <figure v-if="source !== null && figure !== null" class="help_figure" data-testid="help-figure">
    <div class="help_figure_frame">
      <img class="help_figure_image" :src="source" :alt="caption" loading="lazy" />

      <span
        class="help_figure_pin"
        :style="{
          left: `${figure.arrow.x}%`,
          top: `${figure.arrow.y}%`,
          '--help_arrow_angle': `${figure.arrow.angle}deg`,
        }"
        aria-hidden="true"
      >
        <svg class="help_figure_arrow" viewBox="0 0 100 40" focusable="false">
          <path class="help_figure_arrow_halo" :d="ARROW_PATH" fill="none" />
          <path class="help_figure_arrow_line" :d="ARROW_PATH" fill="none" />
        </svg>
      </span>
    </div>

    <figcaption v-if="caption !== ''" class="help_figure_caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped lang="scss">
.help_figure {
  display: flex;
  flex-direction: column;
  gap: $space_xs;
  margin: 0;

  &_frame {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--color_border_strong);
    border-radius: $radius_md;
    background-color: var(--color_surface_alt);
    line-height: 0;
  }

  &_image {
    width: 100%;
    height: auto;
  }

  &_pin {
    position: absolute;
    width: 0;
    height: 0;
    transform: rotate(var(--help_arrow_angle, 0deg));
  }

  &_arrow {
    position: absolute;
    right: 0;
    top: -1.4rem;
    width: 7rem;
    height: 2.8rem;

    &_halo,
    &_line {
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    &_halo {
      stroke: rgb(0 0 0 / 55%);
      stroke-width: 12;
    }

    &_line {
      stroke: #ff3b30;
      stroke-width: 6;
    }
  }

  &_caption {
    color: var(--color_text_muted);
    font-size: 0.8125em;
  }
}
</style>
