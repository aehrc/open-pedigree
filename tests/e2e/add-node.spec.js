import { test, expect } from '@playwright/test';

test('templates toolbar action opens a dialog', async ({ page }) => {
  page.on('dialog', dialog => dialog.dismiss());
  await page.goto('/localEditor.html');
  await expect(page.locator('#canvas svg')).toBeVisible({ timeout: 10000 });

  // Trigger via the editor API
  await page.evaluate(() => window.editor.getTemplateSelector().show());

  // There may be multiple .pedigree-template-chooser elements (startup + manual);
  // at least one should be visible
  await expect(page.locator('.pedigree-template-chooser').first()).toBeVisible({ timeout: 5000 });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await expect(page).toHaveScreenshot('add-node.png', { maxDiffPixelRatio: 0.02 });
});
