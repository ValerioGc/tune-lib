import { installShell } from './shell.js';
import { baseUrl } from './browser.js';

/** Real frontend pages and events; only the native window operations are simulated. */
export async function installDesktop(context, main) {
  const windows = new Map([['main', main]]);
  const calls = [];
  const visible = new Set(['main']);
  let focused = 'main';

  async function open(label, width, height) {
    if (windows.has(label)) {
      return windows.get(label);
    }
    const page = await context.newPage();
    windows.set(label, page);
    await page.setViewportSize({ width, height });
    await installShell(page, { desktop: true, windowLabel: label });
    page.on('close', () => {
      windows.delete(label);
      visible.delete(label);
      if (label === 'mini' && !main.isClosed()) {
        main.evaluate(() => window.__E2E_SHELL__.dispatch('mini://closed', null)).catch(() => {});
      }
    });
    await page.goto(`${baseUrl}?view=${label}`);
    if (label === 'mini') {
      visible.add(label);
    }
    return page;
  }

  async function close(label) {
    const page = windows.get(label);
    visible.delete(label);
    // Let the IPC call return before its page is destroyed.
    if (page) {
      setTimeout(() => {
        page.close().catch(() => {});
      }, 0);
    }
  }

  async function reshape(args) {
    const sizes = args.vertical
      ? [
          [224, 244],
          [252, 340],
        ]
      : [
          [360, 144],
          [400, 172],
        ];
    const [width, height] = sizes[Number(args.expanded)];
    await windows.get('mini')?.setViewportSize({ width, height });
  }

  await context.exposeBinding('__E2E_WINDOW__', async ({ page }, command, args) => {
    const label = [...windows].find(([, target]) => target === page)?.[0];
    calls.push({ label, command, args });
    if (command === 'open_mini_player') {
      await open('mini', 360, 144);
    } else if (command === 'open_mini_close_confirmation') {
      await open('mini-confirm', 420, 304);
    } else if (command === 'close_mini_player') {
      await close('mini');
    } else if (command === 'plugin:window|close') {
      await close(label);
    } else if (command === 'plugin:window|show') {
      visible.add(label);
    } else if (command === 'plugin:window|set_focus') {
      focused = label;
      await page.bringToFront();
    } else if (command === 'plugin:window|hide' || command === 'plugin:window|minimize') {
      visible.delete(label);
    } else if (command === 'set_mini_player_shape') {
      await reshape(args);
    } else if (command === 'quit_app') {
      for (const name of windows.keys()) {
        await close(name);
      }
    }
    return true;
  });
  await installShell(main, { desktop: true });
  return {
    windows,
    calls,
    visible,
    get focused() {
      return focused;
    },
  };
}
