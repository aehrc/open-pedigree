import { test, expect } from '@playwright/test';

test('local storage save produces JSON with GG key', async ({ page }) => {
  // Handle any JS dialogs (e.g. beforeunload) automatically
  page.on('dialog', dialog => dialog.dismiss());

  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  const json = await page.evaluate(() => {
    return window.editor ? window.editor.getGraph().toJSON() : null;
  });

  expect(json).not.toBeNull();
  const parsed = JSON.parse(json);
  expect(parsed).toHaveProperty('GG');
});
