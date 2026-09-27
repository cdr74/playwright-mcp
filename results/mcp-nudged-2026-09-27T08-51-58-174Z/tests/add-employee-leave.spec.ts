import { test, expect, Page } from '@playwright/test';

/**
 * Types a date into one of the Leave module's date-picker text inputs.
 *
 * These fields are custom widgets: setting the value directly (fill()) is
 * not reliably picked up by the widget's internal state, so we click the
 * field, select any existing text and type the date character-by-character.
 * This is needed for both the "From Date" and "To Date" fields, and the
 * "To Date" field additionally auto-copies the "From Date" value into
 * itself, so clearing before typing is required there too (otherwise the
 * two dates get concatenated into an invalid string).
 */
async function setDateField(page: Page, field: import('@playwright/test').Locator, value: string) {
  await field.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(value, { delay: 50 });
}

// Computes tomorrow's date, rolled forward to the next weekday if it lands
// on a Saturday or Sunday, since weekends have no working days and are
// rejected by the leave assignment flow.
function nextFutureWeekday(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test('create employee via PIM and assign leave via Leave module', async ({ page }) => {
  const uniqueSuffix = Date.now().toString();
  const firstName = 'TestQA';
  const lastName = `Playwright${uniqueSuffix}`;
  const fullName = `${firstName} ${lastName}`;
  const leaveDate = nextFutureWeekday();

  // --- Step 1: Create employee via PIM ---
  await page.goto('/web/index.php/pim/addEmployee');

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Confirm the employee was created: URL navigates to the personal details
  // page and the "Personal Details" heading is shown.
  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\//, { timeout: 15000 });
  await expect(page.getByText('Personal Details', { exact: false }).first()).toBeVisible();

  // --- Step 2: Assign leave to the new employee via Leave > Assign Leave ---
  await page.goto('/web/index.php/leave/assignLeave');

  const employeeInput = page.getByPlaceholder('Type for hints...');
  await expect(employeeInput).toBeVisible();
  await employeeInput.click();
  await employeeInput.type(fullName, { delay: 50 });

  const employeeOption = page.getByRole('option', { name: fullName });
  await expect(employeeOption).toBeVisible({ timeout: 10000 });
  await employeeOption.click();
  // Selecting the option fills the input with the employee's full display
  // name, which includes a (blank) middle-name slot and so has a double
  // space between first and last name - check for the last name (the
  // unique part) rather than an exact match on the name we typed.
  await expect(employeeInput).toHaveValue(new RegExp(lastName));

  // Leave Type is a custom dropdown, not a native <select>.
  await page.getByText('-- Select --').first().click();
  const annualLeaveOption = page.getByRole('option', { name: 'Annual Leave' });
  await expect(annualLeaveOption).toBeVisible();
  await annualLeaveOption.click();
  await expect(page.getByText('Annual Leave')).toBeVisible();

  const dateInputs = page.getByPlaceholder('yyyy-mm-dd');
  const fromDate = dateInputs.nth(0);
  const toDate = dateInputs.nth(1);

  await setDateField(page, fromDate, leaveDate);
  await expect(fromDate).toHaveValue(leaveDate);

  await setDateField(page, toDate, leaveDate);
  await expect(toDate).toHaveValue(leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have 0.00 day leave balance, so a confirmation dialog is
  // always expected here. It's a plain modal (no aria-label/aria-labelledby
  // tying its accessible name to the "Confirm Leave Assignment" text), so we
  // locate it by its distinctive body copy rather than role name, and fail
  // loudly if it does not appear rather than silently skipping past it,
  // since its absence would indicate an actual behavior change in the app.
  const confirmDialogText = page.getByText(
    'Employee does not have sufficient leave balance for leave request'
  );
  await expect(confirmDialogText).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Ok' }).click();

  // --- Step 3: Verify the leave request was recorded ---
  const toast = page.locator('.oxd-toast', { hasText: 'Success' });
  await expect(toast).toBeVisible({ timeout: 15000 });
  await expect(toast).toContainText('Successfully Saved');
});
