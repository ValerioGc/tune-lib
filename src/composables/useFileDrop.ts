import { onBeforeUnmount, onMounted, ref } from 'vue';

import { isTauriRuntime } from '@/config/app-config';

type DragDropPayload = { type: string; paths?: string[] };

/**
 * Files dropped onto the window. Only the desktop shell exposes real paths, so in
 * the browser the composable stays inert instead of failing.
 */
export function useFileDrop(onDrop: (paths: string[]) => void) {
  const isDraggingOver = ref(false);
  let unlisten: (() => void) | null = null;

  function handle(payload: DragDropPayload) {
    if (payload.type === 'drop') {
      isDraggingOver.value = false;
      // Folders are forwarded untouched: only the backend can look inside them.
      onDrop(payload.paths ?? []);
      return;
    }

    isDraggingOver.value = payload.type === 'enter' || payload.type === 'over';
  }

  onMounted(async () => {
    if (!isTauriRuntime()) {
      return;
    }

    try {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview');
      unlisten = await getCurrentWebview().onDragDropEvent((event) => handle(event.payload));
    } catch {
      unlisten = null;
    }
  });

  onBeforeUnmount(() => {
    unlisten?.();
    unlisten = null;
  });

  return { isDraggingOver, handle };
}
