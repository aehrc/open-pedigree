import { test, expect } from '@playwright/test';

test('editor loads and SVG canvas is visible', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('dialog', dialog => dialog.dismiss());

  await page.goto('/localEditor.html');

  // Raphaël renders an SVG inside div#canvas
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);

  await expect(page).toHaveScreenshot('editor-load.png', { maxDiffPixelRatio: 0.02 });
});
