<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppSpinner from '@/components/common/placeholder/AppSpinner.vue';
import { sendCloseQuestionOpen } from '@/services/mini-player-bridge';
import { closeMiniPlayer } from '@/services/shell-integration';
import { closeWindow, quitApp, showCurrentWindow } from '@/services/window-controls';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
const remembers = ref(false);
const isSending = ref(false);

onMounted(async () => {
  settings.initialize().catch((error: unknown) => {
    console.error('Loading settings for the close question failed', error);
  });
  // The dock stands back while the question is up: it cannot answer it, and half of what it
  // offers would answer it another way.
  announce(true);
  document.addEventListener('keydown', onKeydown);

  // Wait for Vue to mount the content, then show and focus the native window. A hidden
  // webview may suspend animation frames, so visibility must not depend on one arriving.
  await nextTick();
  await showCurrentWindow();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  settings.dispose();
});

function announce(open: boolean) {
  sendCloseQuestionOpen(open).catch((error: unknown) => {
    console.error('Telling the dock about the close question failed', error);
  });
}

// The window carries no frame, so there is no cross to leave by: the key that dismisses a
// dialog has to answer for it.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }

  cancel().catch((error: unknown) => {
    console.error('Closing the close question failed', error);
  });
}

/** Leaves everything as it was: the question is taken back, the dock stays where it is. */
async function cancel() {
  announce(false);
  await closeWindow();
}

async function choose(quitsApp: boolean) {
  if (isSending.value) {
    return;
  }

  isSending.value = true;

  try {
    if (remembers.value) {
      await settings.setMiniPlayerCloseAction(quitsApp ? 'app' : 'dock');
    }

    // The confirmation window owns the decision and closes the target directly. This avoids
    // losing the click when the mini-player event listener is still being attached.
    if (quitsApp) {
      await quitApp();
    } else {
      await closeMiniPlayer();
    }
  } catch (error) {
    console.error('Applying the close choice failed', error);
  } finally {
    announce(false);
    await closeWindow();
    isSending.value = false;
  }
}
</script>

<template>
  <!-- The window is the dialog. Nothing is drawn inside anything else: a panel on a surface
       of its own, in a window that holds nothing but that panel, reads as a dialog opened
       over a dialog. The frame is the shape, the writing sits straight on it. -->
  <main
    class="mini_confirm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="mini-confirm-title"
    data-tauri-drag-region
  >
    <!-- The remembered answer is read from the store before anything is asked: a question
         that appears one line at a time is a question asked twice. -->
    <div v-if="!settings.isReady" class="mini_confirm_loading">
      <AppSpinner :label="t('mini.confirm.title')" />
    </div>

    <template v-else>
      <h1 id="mini-confirm-title" class="mini_confirm_title">{{ t('mini.confirm.title') }}</h1>
      <p class="mini_confirm_message">{{ t('mini.confirm.message') }}</p>

      <label class="mini_confirm_remember">
        <input v-model="remembers" type="checkbox" data-testid="mini-confirm-remember" />
        <span>{{ t('mini.confirm.remember') }}</span>
      </label>

      <!-- One under the other, each the full width of the window: the answers are sentences,
         and three sentences side by side wrap into a shape nobody can scan. -->
      <footer class="mini_confirm_actions">
        <AppButton
          class="mini_confirm_action"
          variant="primary"
          data-testid="mini-confirm-dock"
          :disabled="isSending"
          @click="choose(false)"
        >
          {{ t('mini.confirm.dockOnly') }}
        </AppButton>
        <AppButton
          class="mini_confirm_action"
          variant="danger"
          data-testid="mini-confirm-app"
          :disabled="isSending"
          @click="choose(true)"
        >
          {{ t('mini.confirm.wholeApp') }}
        </AppButton>
        <AppButton
          class="mini_confirm_action"
          variant="ghost"
          data-testid="mini-confirm-cancel"
          :disabled="isSending"
          @click="cancel"
        >
          {{ t('mini.confirm.cancel') }}
        </AppButton>
      </footer>
    </template>
  </main>
</template>

<style scoped lang="scss">
.mini_confirm {
  display: flex;
  flex-direction: column;
  gap: $space_sm;
  height: 100%;
  padding: $space_md;
  // The one line of the whole window: undecorated, it would otherwise have no edge at all
  // against whatever it is standing over.
  border: 1px solid var(--color_border_strong);
  background-color: var(--color_bg);
  color: var(--color_text);

  &_loading {
    display: grid;
    flex: 1;
    place-items: center;
  }

  &_title {
    font-size: 1.125em;
    font-weight: 600;
  }

  // Takes what is left over, which keeps the answers against the bottom of the window
  // however long the question turns out to be in the language it is read in.
  &_message {
    flex: 1;
    color: var(--color_text_muted);
    line-height: 1.45;
  }

  &_remember {
    display: flex;
    gap: $space_sm;
    align-items: center;
    cursor: pointer;

    input {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color_accent);
      cursor: inherit;
    }
  }

  &_actions {
    display: flex;
    flex-direction: column;
    gap: $space_sm;
  }

  &_action {
    width: 100%;
  }
}
</style>
