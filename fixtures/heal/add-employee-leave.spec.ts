import { test, expect, type Page } from '@playwright/test';

/**
 * Types a date into one of the Assign Leave page's date-picker inputs.
 *
 * These inputs are custom widgets: setting `.fill()` on them can append to
 * whatever is already there instead of replacing it, and the picker popover
 * that opens on focus can linger and intercept the next click. To make this
 * reliable we select-all + delete before typing, and type the date directly
 * (per app notes, typing "yyyy-mm-dd" is picked up correctly whereas some
 * other ways of setting the value are not).
 */
async function typeDateInput(page: Page, input: ReturnType<Page['getByRole']>, date: string) {
  await input.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await input.type(date);
}

// Finds the next weekday (Mon-Fri) strictly after today, formatted yyyy-mm-dd.
// Weekends are not working days in OrangeHRM and a leave request confined to
// a weekend is rejected with "No Working Days Selected", so we avoid them.
function nextWeekdayDate(): string {
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

test('create employee and assign leave', async ({ page }) => {
  const uniqueSuffix = `${Date.now()}`;
  const firstName = `Fname${uniqueSuffix}`;
  const lastName = `Lname${uniqueSuffix}`;

  // --- Step 1: create the employee via PIM ---
  await page.goto('/web/index.php/pim/addEmployee');
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  await expect(page.getByRole('textbox', { name: 'First Name' })).toHaveValue(firstName);
  await expect(page.getByRole('textbox', { name: 'Last Name' })).toHaveValue(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // A successful save navigates to the new employee's Personal Details page;
  // the empNumber in the URL confirms the record was actually created.
  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

  // --- Step 2: assign leave to the new employee via Leave > Assign Leave ---
  await page.goto('/web/index.php/leave/assignLeave');
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(firstName);

  // The suggestion's accessible name is the employee's full name as stored
  // by the server (First [Middle] Last) - match loosely on first/last name
  // rather than assuming exact spacing, since middle-name handling can
  // introduce an extra space for employees with no middle name.
  const employeeOption = page.getByRole('option', { name: new RegExp(`${firstName}\\s+.*${lastName}`) });
  await expect(employeeOption).toBeVisible({ timeout: 10000 });
  const selectedFullName = (await employeeOption.textContent())?.trim() ?? '';
  await employeeOption.click();
  await expect(employeeInput).toHaveValue(selectedFullName);

  // The Leave Type control is a custom widget (div, not a native <select>)
  // with no accessible role/name of its own, so we fall back to a CSS
  // selector scoped to its container. It's the only such widget on this page.
  const leaveTypeSelect = page.locator('.oxd-select-text').first();
  await leaveTypeSelect.click();
  const leaveTypeOption = page.getByRole('option', { name: 'Annual Leave' });
  await expect(leaveTypeOption).toBeVisible();
  await leaveTypeOption.click();
  await expect(leaveTypeSelect).toContainText('Annual Leave');

  const leaveDate = nextWeekdayDate();
  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  const fromDateInput = dateInputs.nth(0);
  const toDateInput = dateInputs.nth(1);

  await typeDateInput(page, fromDateInput, leaveDate);
  await expect(fromDateInput).toHaveValue(leaveDate);

  await typeDateInput(page, toDateInput, leaveDate);
  await expect(toDateInput).toHaveValue(leaveDate);

  // Dismiss the date-picker popover (if still open) so it doesn't intercept
  // the click on "Assign" below.
  const closePickerLink = page.getByText('Close', { exact: true });
  if (await closePickerLink.isVisible().catch(() => false)) {
    await closePickerLink.click();
  }

  await page.getByRole('button', { name: 'Assign' }).click();

  // The new employee has no leave balance yet, so a confirmation dialog is
  // expected here (per app notes). Assert it explicitly rather than treating
  // it as optional, since for a freshly created employee it always fires.
  // The dialog has role="dialog" but no aria-labelledby wiring its title
  // paragraph to it, so it has no accessible name we can match on directly -
  // we instead confirm the dialog's visible text content.
  const confirmDialog = page.getByRole('dialog');
  await expect(confirmDialog).toBeVisible({ timeout: 10000 });
  await expect(confirmDialog).toContainText('Confirm Leave Assignment');
  await expect(confirmDialog).toContainText('does not have sufficient leave balance');

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/v2/leave/employees/leave-requests') && response.request().method() === 'POST'
  );
  await confirmDialog.getByRole('button', { name: 'Ok' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();

  // --- Step 3: verify the leave request was recorded ---
  // The toast is the reliable success signal per app notes; the Leave List
  // search/filter is known to be flaky on this build, so we don't rely on it.
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 10000 });
});
