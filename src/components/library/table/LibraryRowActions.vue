<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppMenu from '@/components/common/controls/AppMenu.vue';
import type { TrackView } from '@/types/library';
import type { MenuItem } from '@/types/menu';

const props = defineProps<{
  track: TrackView;
}>();

const emit = defineEmits<{
  edit: [track: TrackView];
  remove: [track: TrackView];
}>();

const { t } = useI18n();
const menu = ref<InstanceType<typeof AppMenu> | null>(null);

/** Short labels on screen, the full sentence only for screen readers. */
const items = computed<MenuItem[]>(() => [
  {
    id: 'edit',
    label: t('library.row.menu.edit'),
    description: t('library.row.edit', { title: props.track.title }),
    icon: 'edit',
    disabled: props.track.missing,
  },
  {
    id: 'remove',
    label: t('library.row.menu.remove'),
    description: t('library.row.remove', { title: props.track.title }),
    icon: 'remove',
    danger: true,
  },
]);

function run(id: string) {
  if (id === 'edit') {
    emit('edit', props.track);
  } else {
    emit('remove', props.track);
  }
}

async function openMenu() {
  await menu.value?.open();
}

defineExpose({ open: openMenu });
</script>

<template>
  <div class="library_row_menu" @click.stop @dblclick.stop>
    <AppMenu
      ref="menu"
      :items="items"
      :label="t('library.row.actions', { title: track.title })"
      @select="run"
    />
  </div>
</template>

<style scoped lang="scss">
.library_row_menu {
  display: flex;
  justify-content: flex-end;

  // The row menu is the main command of the list: a larger target than a plain menu
  // trigger, and it answers on the accent like the other controls.
  :deep(.app_menu_trigger) {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.05rem;

    &:hover,
    &[aria-expanded='true'] {
      background-color: var(--color_accent_soft);
      color: var(--color_accent);
    }
  }
}
</style>
