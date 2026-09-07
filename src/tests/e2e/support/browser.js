import assert from 'node:assert/strict';

/** Where the suite's Vite server answers, as the runner script sets it. */
export const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:1421';

/** Waits for the one element carrying the test id, and hands it back. */
export async function expectVisible(page, testId) {
  const element = page.getByTestId(testId);
  await element.waitFor({ state: 'visible' });
  assert.equal(await element.count(), 1, `Expected one element with test id "${testId}"`);

  return element;
}

/** Waits for the element carrying the test id to leave the page. */
export async function expectGone(page, testId) {
  const element = page.getByTestId(testId);
  await element.waitFor({ state: 'detached' });
  assert.equal(await element.count(), 0, `Expected no element with test id "${testId}"`);
}

/** Waits for the text to be written inside the element carrying the test id. */
export async function expectTextWithin(page, testId, text) {
  const element = await expectVisible(page, testId);
  await element.getByText(text, { exact: false }).first().waitFor({ state: 'visible' });
}

/** Clicks the element carrying the test id, once it is there to be clicked. */
export async function clickTestId(page, testId) {
  const element = await expectVisible(page, testId);
  await element.click();
}

/** Waits for the element carrying the test id to also match the given CSS selector. */
export function expectMatches(page, testId, selector) {
  return page.locator(`[data-testid="${testId}"]${selector}`).waitFor({ state: 'visible' });
}
