import assert from 'node:assert/strict';
import { Then, When } from '@cucumber/cucumber';

Then('the large audio file plays through byte ranges', async function () {
  await this.page.locator('[data-testid="player-toggle"][aria-pressed="true"]').waitFor();
  await this.page.waitForFunction(
    () => document.querySelector('.player_progress input')?.max === '4500',
  );
  assert.ok(this.audioRequests.length > 0);
  assert.ok(this.audioRequests.every((range) => /^bytes=\d+-\d*$/.test(range)));
});

When('I seek near the end of the large audio file', async function () {
  await this.page.locator('.player_progress input').fill('4400');
  await this.page.waitForFunction(
    () => Number(document.querySelector('.player_progress input')?.value) >= 4400,
  );
});

Then('the large audio file resumes after a pause', async function () {
  await this.page.getByTestId('player-toggle').click();
  await this.page.locator('[data-testid="player-toggle"][aria-pressed="false"]').waitFor();
  await this.page.getByTestId('player-toggle').click();
  await this.page.locator('[data-testid="player-toggle"][aria-pressed="true"]').waitFor();
  await this.page.waitForFunction(
    () => Number(document.querySelector('.player_progress input')?.value) >= 4401,
  );
  assert.ok(this.audioRequests.every((range) => typeof range === 'string'));
});
