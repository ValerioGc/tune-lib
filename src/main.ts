import { createPinia } from 'pinia';
import { createApp } from 'vue';

import { i18n } from './i18n';
import { silenceWebviewMenu } from './services/context-menu';
import './styles/common.scss';
import './styles/global.scss';

// Every window is served by this entry point, so the browser menu is taken off all of them
// at once. Development keeps it: it is the way to the inspector.
if (import.meta.env.PROD) {
  silenceWebviewMenu();
}

/**
 * Each Tauri window uses the same entry point, but only needs one root view. Keeping these
 * imports lazy prevents the main window from carrying the auxiliary window code, and keeps
 * the mini-player webview from downloading the full application view.
 */
async function resolveRootView() {
  const view = new URLSearchParams(globalThis.location.search).get('view');

  if (view === 'mini-confirm') {
    return (await import('./views/MiniConfirmView.vue')).default;
  }

  if (view === 'mini') {
    return (await import('./views/MiniPlayerView.vue')).default;
  }

  return (await import('./App.vue')).default;
}

resolveRootView().then((rootView) => {
  createApp(rootView).use(createPinia()).use(i18n).mount('#app');
});
