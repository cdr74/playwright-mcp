import { test, expect } from '@playwright/test';

/**
 * Returns a future date (yyyy-mm-dd) that falls on a weekday, starting
 * `daysFromNow` days ahead of today and rolling forward past any weekend.
 */
function getFutureWeekdayDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('assign leave to a newly created employee', async ({ page }) => {
  const uniqueSuffix = Date.now();
  const firstName = `Thomas${uniqueSuffix}`;
  const lastName = `Mueller${uniqueSuffix}`;
  const fullName = `${firstName} ${lastName}`;
  // The employee's full name can show up with extra whitespace between
  // first and last name (no middle name provided), so match loosely.
  const fullNamePattern = new RegExp(
    `${escapeRegExp(firstName)}\\s+${escapeRegExp(lastName)}`
  );
  const leaveDate = getFutureWeekdayDate(14);

  await page.goto('/web/index.php/dashboard/index');

  // --- 1. Create a new employee via PIM ---
  await page.getByRole('link', { name: 'PIM' }).click();
  await page.getByRole('heading', { name: 'Employee Information' }).waitFor();

  await page.getByRole('button', { name: /Add/ }).click();
  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  await page.getByRole('button', { name: 'Save' }).click();

  // Confirm the employee was created by checking the Personal Details page header
  await expect(page.locator('.orangehrm-edit-employee-name')).toContainText(
    fullNamePattern,
    { timeout: 15000 }
  );

  // --- 2. Assign a leave request to that employee via Leave > Assign Leave ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).waitFor();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.pressSequentially(firstName, { delay: 50 });
  const suggestion = page.getByRole('option', { name: fullName });
  await suggestion.waitFor({ state: 'visible', timeout: 10000 });
  await suggestion.click();
  await expect(employeeInput).toHaveValue(fullNamePattern);

  // Leave Type dropdown - pick "Annual Leave" (the only configured leave type)
  const leaveTypeSelect = page.locator('.oxd-select-text').first();
  await leaveTypeSelect.click();
  await page.getByRole('option', { name: 'Annual Leave' }).click();
  await expect(leaveTypeSelect).toHaveText('Annual Leave');

  // From Date and To Date - single day leave on a future weekday.
  // Typing the date (rather than setting the value directly) is required
  // for this app's date pickers to register the value. The From Date's
  // value is auto-copied into To Date, so it must be cleared before typing.
  const dateInputs = page.getByPlaceholder('yyyy-mm-dd');

  async function setDateField(index: number) {
    const field = dateInputs.nth(index);
    await field.click();
    await field.press('Control+A');
    await field.press('Backspace');
    await field.pressSequentially(leaveDate, { delay: 50 });
    await page.getByRole('heading', { name: 'Assign Leave' }).click();
    await expect(field).toHaveValue(leaveDate);
  }

  await setDateField(0);
  await setDateField(1);

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance - confirm the "insufficient balance" dialog
  const okButton = page.getByRole('button', { name: 'Ok' });
  await okButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await okButton.isVisible().catch(() => false)) {
    await okButton.click();
  }

  // --- 3. Verify the leave request was recorded successfully ---
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });
});
