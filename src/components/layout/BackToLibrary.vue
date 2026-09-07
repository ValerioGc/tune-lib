<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useNavigationStore } from '@/stores/navigation';
import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';

const { t } = useI18n();
const navigation = useNavigationStore();
</script>

<template>
  <AppButton
    class="back_to_library"
    variant="ghost"
    data-testid="back-to-library"
    @click="navigation.go('library')"
  >
    <AppIcon name="back" />
    {{ t('nav.backToLibrary') }}
  </AppButton>
</template>

<style scoped lang="scss">
.back_to_library {
  align-self: flex-start;
}
</style>
