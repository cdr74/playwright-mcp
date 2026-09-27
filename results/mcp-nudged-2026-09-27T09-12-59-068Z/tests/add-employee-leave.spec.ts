import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Types a date into one of OrangeHRM's custom date-picker text inputs.
 *
 * These fields are plain text inputs (not native <input type="date">), and
 * the "To Date" field in particular gets auto-populated with a copy of the
 * "From Date" value as soon as the leave type / employee are selected.
 * A plain `.fill()` (or typing without first clearing) was observed to
 * concatenate onto that pre-existing value (e.g. "2026-09-292026-09-29"),
 * which then fails the app's "Should be a valid date in yyyy-mm-dd format"
 * validation. So we explicitly select-all + delete before typing character
 * by character. Typing also opens a calendar popup with a "Close" link,
 * which we dismiss so it doesn't cover subsequent fields/buttons.
 */
async function typeDateField(page: Page, field: Locator, dateStr: string) {
  await field.click();
  await field.press('ControlOrMeta+A');
  await field.press('Delete');
  await field.pressSequentially(dateStr, { delay: 20 });
  await expect(field).toHaveValue(dateStr);

  const closeCalendarLink = page.getByText('Close', { exact: true });
  if (await closeCalendarLink.isVisible().catch(() => false)) {
    await closeCalendarLink.click();
  }
}

/** Returns a future weekday (Mon-Fri) date in yyyy-mm-dd format, since the
 * app rejects leave requests that fall entirely on a weekend. */
function getFutureWeekdayDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7); // comfortably in the future
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

test('create employee via PIM and assign them a leave request via Leave module', async ({ page }) => {
  const uniqueSuffix = Date.now();
  const firstName = `TestFirst${uniqueSuffix}`;
  const lastName = `TestLast${uniqueSuffix}`;
  // The "Employee Full Name" concatenation used internally by the app joins
  // First + Middle + Last with spaces; since we leave Middle Name blank,
  // some places (e.g. the Assign Leave autocomplete input's filled-in
  // value) end up with a double space between first and last name, while
  // others (e.g. the suggestion list option, the PIM heading) use a single
  // space. Match loosely on both names with flexible whitespace between.
  const fullNamePattern = new RegExp(`^${firstName}\\s+${lastName}$`);
  const leaveDate = getFutureWeekdayDate();

  // --- Step 1: Create the employee via PIM ---
  await page.goto('/web/index.php/pim/addEmployee');
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Confirm the employee was actually created: URL moves to the new
  // employee's Personal Details page and the heading shows their name.
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: fullNamePattern })).toBeVisible();

  // --- Step 2: Assign leave to that employee via Leave > Assign Leave ---
  await page.goto('/web/index.php/leave/assignLeave');
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.fill(firstName);
  const employeeOption = page.getByRole('option', { name: fullNamePattern });
  await expect(employeeOption).toBeVisible({ timeout: 10000 });
  await employeeOption.click();
  await expect(employeeInput).toHaveValue(fullNamePattern);

  // Leave Type is a custom dropdown widget, not a native <select>.
  await page.getByText('-- Select --', { exact: true }).click();
  const annualLeaveOption = page.getByRole('option', { name: 'Annual Leave' });
  await expect(annualLeaveOption).toBeVisible();
  await annualLeaveOption.click();
  await expect(page.getByText('Annual Leave', { exact: true })).toBeVisible();

  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  await typeDateField(page, dateInputs.nth(0), leaveDate);
  await typeDateField(page, dateInputs.nth(1), leaveDate);

  // New employees always start with 0.00 Day(s) balance, so the app shows
  // an inline "Balance not sufficient" note as soon as the leave type/dates
  // are set. This is expected here and not a failure - it's only a problem
  // if the subsequent confirmation flow doesn't let us proceed anyway.
  const balanceWarning = page.getByText('Balance not sufficient');
  if (await balanceWarning.isVisible().catch(() => false)) {
    test.info().annotations.push({
      type: 'note',
      description: 'New employee has 0.00 Day(s) leave balance, as expected - proceeding through the "insufficient balance" confirmation dialog.',
    });
  }

  // Set up the response listener before clicking, since confirming the
  // dialog is what actually fires the save request.
  const leaveRequestResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v2/leave/employees/leave-requests') &&
      response.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Assign' }).click();

  // Confirm dialog appears because of the insufficient balance noted above.
  const confirmDialogHeading = page.getByText('Confirm Leave Assignment', { exact: true });
  await expect(confirmDialogHeading).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Ok' }).click();

  // --- Step 3: Verify the leave request was recorded ---

  // Primary signal per app notes: the Leave List search is unreliable, so
  // rely on the API response plus the "Success" toast and form reset
  // instead of re-querying the list.
  const leaveRequestResponse = await leaveRequestResponsePromise;
  expect(leaveRequestResponse.status()).toBe(200);
  const responseBody = await leaveRequestResponse.json();
  expect(responseBody.data.leaveType.name).toBe('Annual Leave');
  expect(responseBody.data.dateApplied).toBe(leaveDate);

  await expect(page.getByText('Success', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Successfully Saved')).toBeVisible();

  // The form resetting to its empty state is the UI's own confirmation
  // that the assignment completed and it's ready for a new entry.
  await expect(employeeInput).toHaveValue('');
  await expect(page.getByText('-- Select --', { exact: true })).toBeVisible();
  await expect(dateInputs.nth(0)).toHaveValue('');
  await expect(dateInputs.nth(1)).toHaveValue('');
});
