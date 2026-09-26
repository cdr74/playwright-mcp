import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8081';

test('Add employee and assign leave', async ({ page }) => {
  const unique = Date.now().toString();
  const firstName = `Test${unique}`;
  const lastName = `Auto${unique}`;

  // Step 1-6: Create employee via PIM
  await page.goto(`${BASE_URL}/web/index.php/pim/addEmployee`);

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/);
  await expect(page.getByText('Personal Details').first()).toBeVisible();

  // Step 7: Navigate to Assign Leave page
  await page.goto(`${BASE_URL}/web/index.php/leave/assignLeave`);
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  // Step 8-9: Select employee via autocomplete
  const employeeInput = page.getByPlaceholder('Type for hints...');
  await employeeInput.click();
  await employeeInput.fill('');
  await employeeInput.type(firstName, { delay: 100 });

  const option = page.getByRole('option', { name: `${firstName} ${lastName}` });
  await option.waitFor({ state: 'visible', timeout: 10000 });
  await option.click();

  // Step 10: Select Leave Type
  await page.locator('.oxd-select-text-input', { hasText: '-- Select --' }).first().click();
  const leaveTypeOption = page.getByRole('option', { name: 'Annual Leave' });
  await leaveTypeOption.waitFor({ state: 'visible' });
  await leaveTypeOption.click();

  // Step 11: From Date
  const dateInputs = page.getByPlaceholder('yyyy-mm-dd');
  const fromDate = dateInputs.nth(0);
  const toDate = dateInputs.nth(1);

  const futureDate = '2026-09-28'; // future Monday

  await fromDate.click();
  await fromDate.press('Control+a');
  await fromDate.pressSequentially(futureDate, { delay: 50 });

  // Close date picker popup if visible
  const closeLinks = page.getByText('Close', { exact: true });
  if (await closeLinks.first().isVisible().catch(() => false)) {
    await closeLinks.first().click();
  }

  // Step 12: To Date
  await toDate.click();
  await toDate.press('Control+a');
  await toDate.pressSequentially(futureDate, { delay: 50 });

  const closeLinks2 = page.getByText('Close', { exact: true });
  if (await closeLinks2.first().isVisible().catch(() => false)) {
    await closeLinks2.first().click();
  }

  // Step 13: Verify Duration = Full Day
  await expect(page.getByText('Full Day')).toBeVisible({ timeout: 10000 });

  // Step 14: Click Assign
  await page.getByRole('button', { name: 'Assign' }).click();

  // Step 15: Confirmation dialog for insufficient leave balance
  const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Confirm Leave Assignment' });
  const okButton = confirmDialog.getByRole('button', { name: 'Ok' });
  await okButton.waitFor({ state: 'visible', timeout: 10000 });
  await okButton.click();

  // Step 16: Verify success message
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });

  // Step 17: Verify form reset
  await expect(page.getByPlaceholder('Type for hints...')).toHaveValue('');
});
