<script setup lang="ts">
import CoverImage from '@/components/library/CoverImage.vue';
import type { TrackView } from '@/types/library';

defineProps<{ track: TrackView }>();
</script>

<template>
  <!-- The table is virtualised, so a row only exists while it is on screen: no need to
       defer the cover a second time. -->
  <CoverImage :track="track" size="fill" eager />
</template>
