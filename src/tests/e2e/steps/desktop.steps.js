import assert from 'node:assert/strict';
import { Then, When } from '@cucumber/cucumber';
import { expectVisible, expectGone, clickTestId } from '../support/browser.js';

Then('ten dock round trips leave one window and no extra main subscriptions', async function () {
  const initial = await this.page.evaluate(() => window.__E2E_SHELL__.listenerCount());
  for (let cycle = 0; cycle < 10; cycle += 1) {
    await clickTestId(this.page, 'window-tray');
    const dock = this.desktop.windows.get('mini') ?? (await this.context.waitForEvent('page'));
    await dock.getByTestId('mini-player').getByText('Midnight Ride', { exact: true }).waitFor();
    await Promise.all([dock.waitForEvent('close'), clickTestId(dock, 'mini-expand')]);
    await this.page.getByTestId('player-full').waitFor();
  }
  assert.equal(this.context.pages().length, 1);
  assert.equal(await this.page.evaluate(() => window.__E2E_SHELL__.listenerCount()), initial);
});

Then('the separate dock shows {string}', async function (title) {
  this.dock = this.desktop.windows.get('mini') ?? (await this.context.waitForEvent('page'));
  await this.dock.getByTestId('mini-player').getByText(title, { exact: true }).waitFor();
  assert.equal(this.desktop.visible.has('main'), false);
});

When('I restore the full player from the separate dock', async function () {
  await clickTestId(this.dock, 'mini-expand');
});

Then('the main window is shown and focused', async function () {
  await this.page.waitForFunction(
    () =>
      window.__E2E_SHELL__.calls.filter((call) => call.command === 'plugin:window|set_focus')
        .length >= 2,
  );
  assert.equal(this.desktop.visible.has('main'), true);
  assert.equal(this.desktop.focused, 'main');
});

When('I expand and rotate the separate dock', async function () {
  await clickTestId(this.dock, 'mini-level');
  await clickTestId(this.dock, 'mini-menu');
  await clickTestId(this.dock, 'mini-orientation');
});

Then('the separate dock is expanded and vertical', async function () {
  await this.dock.locator('.mini_player_expanded.mini_player_vertical').waitFor();
  await this.dock.waitForFunction(() => innerHeight > innerWidth);
  const box = await this.dock.getByTestId('mini-player').boundingBox();
  assert.ok(box.height > box.width);
});

When('I close the separate dock', async function () {
  await clickTestId(this.dock, 'mini-close');
});

Then('the separate confirmation is shown and focused after one click', async function () {
  this.confirmation =
    this.desktop.windows.get('mini-confirm') ?? (await this.context.waitForEvent('page'));
  await expectVisible(this.confirmation, 'mini-confirm-cancel');
  await this.confirmation.waitForFunction(() =>
    window.__E2E_SHELL__.calls.some((call) => call.command === 'plugin:window|set_focus'),
  );
  assert.equal(this.desktop.visible.has('mini-confirm'), true);
  assert.equal(this.desktop.focused, 'mini-confirm');
  const calls = this.desktop.calls.filter((call) => call.label === 'mini-confirm');
  assert.ok(
    calls.findIndex((call) => call.command === 'plugin:window|show') <
      calls.findIndex((call) => call.command === 'plugin:window|set_focus'),
  );
  await expectVisible(this.dock, 'mini-veil');
});

When('I cancel the separate confirmation', async function () {
  await Promise.all([
    this.confirmation.waitForEvent('close'),
    clickTestId(this.confirmation, 'mini-confirm-cancel'),
  ]);
});

Then('the separate dock is interactive again', async function () {
  await expectGone(this.dock, 'mini-veil');
  await clickTestId(this.dock, 'mini-menu');
  await expectVisible(this.dock, 'mini-orientation');
  await clickTestId(this.dock, 'mini-menu');
});

When('I close only the dock from the separate confirmation', async function () {
  await Promise.all([
    this.dock.waitForEvent('close'),
    clickTestId(this.confirmation, 'mini-confirm-dock'),
  ]);
});

Then('the application remains running without the separate dock', async function () {
  assert.equal(this.page.isClosed(), false);
  assert.equal(this.desktop.windows.has('mini'), false);
  assert.ok(!this.desktop.calls.some((call) => call.command === 'quit_app'));
});

Then('playback advances without publishing dock updates', async function () {
  await expectVisible(this.page, 'player-bar');
  const initial = await this.page.getByTestId('player-position').innerText();
  // Wait for the real audio element's progress to reach the visible time display.
  await this.page.waitForFunction(
    (text) =>
      document.querySelector('[data-testid="player-position"]').textContent.trim() !== text.trim(),
    initial,
  );
  const emitted = await this.page.evaluate(() =>
    window.__E2E_SHELL__.calls.filter(
      (call) =>
        call.command === 'plugin:event|emit' &&
        ['mini://state', 'mini://progress'].includes(call.args.event),
    ),
  );
  assert.deepEqual(emitted, []);
});

Then('the return button matches the help button', async function () {
  const settings = await this.page.getByTestId('back-to-library').boundingBox();
  const page = await this.page.getByTestId('settings-page').boundingBox();
  assert.ok(settings.width < page.width / 2);
  assert.ok(Math.abs(settings.x - page.x) < 2);
  await clickTestId(this.page, 'open-help');
  await this.page.locator('.help_view').waitFor();
  const help = await this.page.getByTestId('back-to-library').boundingBox();
  assert.ok(Math.abs(settings.width - help.width) < 2);
  assert.ok(Math.abs(settings.height - help.height) < 2);
});
