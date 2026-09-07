import { Given, Then, When } from '@cucumber/cucumber';

import { baseUrl, clickTestId, expectVisible } from '../support/browser.js';

Given('the TuneLib library is open', async function () {
  await this.page.goto(baseUrl);
  await expectVisible(this.page, 'open-settings');
  await expectVisible(this.page, 'library-view');
});

When('I open the settings view', async function () {
  await clickTestId(this.page, 'open-settings');
});

When('I return to the library', async function () {
  await clickTestId(this.page, 'back-to-library');
});

Then('the settings page is visible', async function () {
  await expectVisible(this.page, 'settings-page');
});

Then('the library view is visible', async function () {
  await expectVisible(this.page, 'library-view');
});
