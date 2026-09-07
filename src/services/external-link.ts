import { isTauriRuntime } from '@/config/app-config';

/**
 * Opens a link in the system browser. Inside the shell the webview must not navigate
 * away from the app, so the request goes through the Tauri opener plugin.
 */
export async function openExternal(url: string): Promise<boolean> {
  try {
    if (isTauriRuntime()) {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);

      return true;
    }

    window.open(url, '_blank', 'noopener');

    return true;
  } catch (error) {
    console.error('Unable to open the external link', error);

    return false;
  }
}
