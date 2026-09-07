import assert from 'node:assert/strict';
import { Given, Then, When } from '@cucumber/cucumber';

import {
  baseUrl,
  clickTestId,
  expectGone,
  expectMatches,
  expectTextWithin,
  expectVisible,
} from '../support/browser.js';
import {
  allowConfirmationWindow,
  dockCommands,
  waitForDockCommand,
  waitForShellCall,
} from '../support/shell.js';

Given('the floating dock is open', async function () {
  // The desktop shell opens the dock as a window of its own on the same page: here it is
  // that page, asked for directly.
  await this.page.goto(`${baseUrl}?view=mini`);
  await expectVisible(this.page, 'mini-player');
});

Given('the shell can open the closing question in its own window', async function () {
  await allowConfirmationWindow(this.page);
});

When('I play the track {string}', async function (title) {
  // The row is opened the way it is opened in the app: a double click anywhere on it
  // starts the track. The title cell carries the whole title, narrow column or not, which
  // is what makes it the one thing here that can be named exactly.
  await this.page.getByTitle(title, { exact: true }).dblclick();
});

When('I expand the player', async function () {
  await clickTestId(this.page, 'player-expand');
});

When('I collapse the player', async function () {
  await clickTestId(this.page, 'player-collapse');
});

When('I close the full player', async function () {
  await clickTestId(this.page, 'player-full-close');
});

When('I send the window to the tray', async function () {
  await clickTestId(this.page, 'window-tray');
});

When('I expand the dock', async function () {
  await clickTestId(this.page, 'mini-level');
});

When('I turn the dock vertical', async function () {
  await clickTestId(this.page, 'mini-menu');
  await clickTestId(this.page, 'mini-orientation');
});

When('I close the dock', async function () {
  await clickTestId(this.page, 'mini-close');
});

When('I keep the dock open', async function () {
  await clickTestId(this.page, 'mini-close-cancel');
});

When('I answer that only the dock closes', async function () {
  await clickTestId(this.page, 'mini-close-dock');
});

Then('the player bar shows {string}', async function (title) {
  await expectTextWithin(this.page, 'player-bar', title);
});

Then('the full player shows {string}', async function (title) {
  await expectTextWithin(this.page, 'player-full', title);
});

Then('the full player is gone', async function () {
  await expectGone(this.page, 'player-full');
});

Then('no player is on screen', async function () {
  await expectGone(this.page, 'player-full');
  await expectGone(this.page, 'player-bar');
});

Then('the shell is asked to open the floating dock as {word}', async function (orientation) {
  const [call] = await waitForShellCall(this.page, 'open_mini_player');

  assert.equal(call.args.vertical, orientation === 'vertical');
});

Then('the dock asks the main window for what is playing', async function () {
  await waitForDockCommand(this.page, 'sync');
});

Then('the dock shows {string}', async function (title) {
  await expectTextWithin(this.page, 'mini-player', title);
});

Then('the dock is expanded', async function () {
  await expectMatches(this.page, 'mini-level', '[aria-pressed="true"]');
});

Then('the dock is vertical', async function () {
  await expectMatches(this.page, 'mini-player', '.mini_player_vertical');
});

Then('the shell is asked to reshape the dock as {word}', async function (shape) {
  const calls = await waitForShellCall(this.page, 'set_mini_player_shape');
  const last = calls.at(-1);

  assert.equal(last.args[shape === 'vertical' ? 'vertical' : 'expanded'], true);
});

Then('the closing question is on screen', async function () {
  await expectVisible(this.page, 'mini-close-cancel');
  await expectVisible(this.page, 'mini-close-dock');
  await expectVisible(this.page, 'mini-close-app');
});

Then('the closing question is gone', async function () {
  await expectGone(this.page, 'mini-close-cancel');
  await expectGone(this.page, 'mini-close-dock');
  await expectGone(this.page, 'mini-close-app');
});

Then('the shell is asked to close the floating dock', async function () {
  await waitForShellCall(this.page, 'close_mini_player');
});

Then('the main window is never asked to quit', async function () {
  const commands = await dockCommands(this.page);

  assert.ok(
    !commands.some((command) => command.action === 'quit'),
    'The dock asked the main window to quit',
  );
});

Then('the dock stands behind the question', async function () {
  await expectVisible(this.page, 'mini-veil');
});
