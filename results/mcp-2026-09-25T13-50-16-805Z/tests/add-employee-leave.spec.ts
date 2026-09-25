import { test, expect } from '@playwright/test';

test('add employee via PIM and assign leave', async ({ page }) => {
  const uniqueSuffix = Date.now();
  const firstName = 'Test';
  const lastName = `Employee${uniqueSuffix}`;
  const fullName = `${firstName} ${lastName}`;

  // 1. Create employee via PIM
  await page.goto('http://localhost:8081/web/index.php/pim/addEmployee');

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

  // 2. Assign leave to the new employee
  await page.goto('http://localhost:8081/web/index.php/leave/assignLeave');

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(fullName);

  const employeeOption = page.getByRole('option', { name: fullName, exact: true });
  await expect(employeeOption).toBeVisible({ timeout: 10000 });
  await employeeOption.click();

  // Open Leave Type custom dropdown
  await page.locator('.oxd-select-text--after').first().click();
  const leaveTypeListbox = page.locator('.oxd-select-dropdown').first();
  await expect(leaveTypeListbox).toBeVisible();
  // First option is the "-- Select --" placeholder itself; pick the first real leave type.
  const leaveTypeOption = leaveTypeListbox.getByRole('option').filter({ hasNotText: '-- Select --' }).first();
  await expect(leaveTypeOption).toBeVisible();
  await leaveTypeOption.click();

  // Fill From Date and To Date
  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  const futureDate = '2026-12-01';

  const fromDateInput = dateInputs.nth(0);
  await fromDateInput.click();
  await page.keyboard.press('ControlOrMeta+A');
  await fromDateInput.pressSequentially(futureDate);
  await page.keyboard.press('Escape');

  const toDateInput = dateInputs.nth(1);
  await toDateInput.click();
  await page.keyboard.press('ControlOrMeta+A');
  await toDateInput.pressSequentially(futureDate);
  await page.keyboard.press('Escape');

  // Submit assignment
  await page.getByRole('button', { name: 'Assign' }).click();

  // Confirmation dialog for insufficient leave balance (expected for new employee
  // with no entitlement yet). Wait for it, but don't fail the test if it never
  // appears (e.g. if the employee happened to have sufficient balance).
  const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Confirm Leave Assignment' });
  try {
    await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });
    await confirmDialog.getByRole('button', { name: 'Ok' }).click();
  } catch {
    // No confirmation dialog appeared - proceed straight to checking the toast.
  }

  // Primary success signal: toast notification
  await expect(page.locator('.oxd-toast')).toContainText('Successfully Saved', { timeout: 10000 });
});
