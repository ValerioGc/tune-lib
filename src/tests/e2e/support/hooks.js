import { After, AfterAll, Before, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';

import { installShell } from './shell.js';
import { installDesktop } from './desktop.js';

setDefaultTimeout(15_000);

let browser;

BeforeAll(async () => {
  browser = await chromium.launch({
    headless: true,
    // The player starts on a double click, which is a gesture the browser accepts, but the
    // dock and the preloaded track start on their own: without this the engine would report
    // a failure the desktop app never sees.
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
});

Before(async function () {
  this.context = await browser.newContext();
  this.page = await this.context.newPage();
});

/**
 * Scenarios that need something to play, and a shell to play it through, ask for one: the
 * plain browser has no library and no floating dock, which is what the other scenarios run
 * against.
 */
Before({ tags: '@shell' }, async function () {
  await installShell(this.page);
});

Before({ tags: '@desktop' }, async function () {
  this.desktop = await installDesktop(this.context, this.page);
});

Before({ tags: '@large-audio' }, async function () {
  this.audioRequests = [];
  await installShell(this.page, { largeAudio: true, audioRequests: this.audioRequests });
});

After(async function () {
  await this.context.close();
});

AfterAll(async () => {
  await browser.close();
});
