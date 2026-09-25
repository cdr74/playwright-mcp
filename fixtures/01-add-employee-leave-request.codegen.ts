import { test, expect } from '@playwright/test';

test.use({
  viewport: {
    height: 1200,
    width: 1900
  }
});

test('test', async ({ page }) => {
  await page.goto('http://localhost:8081/web/index.php/auth/login');
  await page.getByRole('textbox', { name: 'Username' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('Admin');
  await page.getByRole('textbox', { name: 'Username' }).press('Tab');
  await page.getByRole('textbox', { name: 'Password' }).fill('PwMcpBench#2026');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'PIM' }).click();
  await page.getByRole('button', { name: ' Add' }).click();
  await page.getByRole('textbox', { name: 'First Name' }).click();
  await page.getByRole('textbox', { name: 'First Name' }).fill('Thomas');
  await page.getByRole('textbox', { name: 'First Name' }).press('Tab');
  await page.getByRole('textbox', { name: 'Middle Name' }).press('Tab');
  await page.getByRole('textbox', { name: 'Last Name' }).fill('Mueller');
  await page.getByRole('textbox', { name: 'Last Name' }).press('Tab');
  await page.getByRole('textbox').nth(4).press('Tab');
  await page.locator('.oxd-switch-input').click();
  await page.getByLabel('', { exact: true }).check();
  await page.getByRole('textbox').nth(5).click();
  await page.getByRole('textbox').nth(5).fill('ThoMu');
  await page.locator('input[type="password"]').first().click();
  await page.locator('input[type="password"]').first().fill('PwMcpBench#2026');
  await page.locator('input[type="password"]').nth(1).click();
  await page.locator('input[type="password"]').nth(1).fill('PwMcpBench#2026');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await page.getByRole('textbox', { name: 'Type for hints...' }).click();
  await page.getByRole('textbox', { name: 'Type for hints...' }).fill('Thom');
  await page.getByText('-- Select --').click();
  await page.getByRole('textbox', { name: 'yyyy-mm-dd' }).first().click();
  await page.getByText('22').click();
  await page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1).click();
  await page.getByText('23').click();
  await page.getByText('-- Select --').click();
  await page.getByText('-- Select --').click();
  await page.getByRole('button', { name: 'Assign' }).click();
  await page.getByRole('button', { name: 'Ok' }).click();
});