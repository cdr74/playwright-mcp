import { test, expect } from '@playwright/test';

test('add employee and assign leave', async ({ page }) => {
  const timestamp = Date.now();
  const firstName = 'TestQA';
  const lastName = `Auto${timestamp}`;
  const fullName = `${firstName} ${lastName}`;

  // Step 1: Create a new employee via PIM
  await page.goto('http://localhost:8081/web/index.php/pim/addEmployee');

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Confirm employee was created
  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\//, { timeout: 15000 });
  await expect(page.getByText('Personal Details').first()).toBeVisible();

  // Step 2: Assign leave to the new employee via Leave -> Assign Leave
  await page.goto('http://localhost:8081/web/index.php/leave/assignLeave');

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.type(fullName, { delay: 100 });

  const suggestion = page.getByRole('option', { name: fullName });
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();

  // Select Leave Type
  await page.getByText('-- Select --').first().click();
  await page.getByRole('option', { name: 'Annual Leave' }).click();

  // Pick a future weekday date (Monday, 2026-10-05)
  const futureDate = '2026-10-05';

  const fromDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).first();
  await fromDateInput.click();
  await fromDateInput.fill('');
  await fromDateInput.type(futureDate, { delay: 50 });
  await page.keyboard.press('Escape');

  const toDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1);
  await toDateInput.click();
  await toDateInput.press('Control+A');
  await toDateInput.type(futureDate, { delay: 50 });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Assign' }).click();

  // Confirm leave assignment dialog (insufficient balance warning expected for new employee)
  const okButton = page.getByRole('button', { name: 'Ok' });
  await expect(okButton).toBeVisible({ timeout: 10000 });
  await okButton.click();

  // Step 3: Verify success
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });
});
