import { test, expect, type Page } from '@playwright/test';

/**
 * Types a date into one of the Assign Leave page's "yyyy-mm-dd" fields and
 * dismisses the date-picker calendar popup that appears as a side effect.
 * Setting the value directly isn't reliably picked up by the app, and the
 * popup calendar (which opens on focus/typing) would otherwise sit on top
 * of subsequent fields, so this is factored out since it's needed for both
 * the "From Date" and "To Date" fields.
 */
async function fillDateField(page: Page, field: ReturnType<Page['getByRole']>, date: string) {
  await field.click();
  // Select any existing text before typing - the "To Date" field can get
  // auto-populated after "From Date" is set, and a plain type() would
  // append to that instead of replacing it.
  await field.press('ControlOrMeta+a');
  await field.fill(date);
  await expect(field).toHaveValue(date);

  const closeCalendarLink = page.getByText('Close', { exact: true }).first();
  await closeCalendarLink.click();
  await expect(closeCalendarLink).toBeHidden();
}

test('create employee via PIM and assign them leave', async ({ page }) => {
  const uniqueId = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const firstName = `TestFirst${uniqueId}`;
  const lastName = `TestLast${uniqueId}`;

  // ---- Step 1: Create a new employee via PIM ----
  await page.goto('/web/index.php/pim/addEmployee');
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Confirm employee creation by waiting for navigation to the Personal
  // Details view (URL includes the new employee's number) and the heading.
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });
  await expect(page.getByText('Personal Details', { exact: false }).first()).toBeVisible();

  // ---- Step 2: Assign leave to the new employee via Leave > Assign Leave ----
  await page.goto('/web/index.php/leave/assignLeave');
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  // Employee Name is a custom autocomplete: type part of the name, wait
  // for the suggestion, then click it. The employee has no middle name, so
  // the suggestion/selected value may render with a doubled space between
  // first and last name - match loosely on both name parts rather than an
  // exact full-name string.
  const employeeNameInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeNameInput.click();
  await employeeNameInput.fill(firstName);

  const nameRegex = new RegExp(`${firstName}\\s+${lastName}`);
  const suggestion = page.getByText(nameRegex);
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();
  await expect(employeeNameInput).toHaveValue(nameRegex);

  // Leave Type is a custom dropdown widget, not a native <select>.
  await page.getByText('-- Select --', { exact: true }).click();
  const leaveTypeOption = page.getByRole('option', { name: 'Annual Leave' });
  await expect(leaveTypeOption).toBeVisible();
  await leaveTypeOption.click();
  await expect(page.getByText('Annual Leave', { exact: true })).toBeVisible();

  // Pick a future weekday (weekends have no working days and get rejected).
  // 2026-10-05 is a Monday.
  const leaveDate = '2026-10-05';
  const dateFields = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  await fillDateField(page, dateFields.nth(0), leaveDate);
  await fillDateField(page, dateFields.nth(1), leaveDate);

  // Wait for the app's async leave-balance check to finish before
  // submitting - a new employee has no balance yet, so this renders as
  // "Balance not sufficient". Submitting before this resolves can leave
  // the request unsaved.
  await expect(page.getByText('Balance not sufficient')).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance, so a confirmation dialog is shown
  // ("Employee does not have sufficient leave balance..."). This is
  // expected in this environment (see app notes) and not a real failure -
  // confirm it to proceed with the assignment. The dialog can take a beat
  // to render after the click (it's driven by an async validation call),
  // so we poll for it with `waitFor` rather than an instantaneous
  // `isVisible()` check, which does not wait at all and would report it as
  // absent purely due to a timing race. `exact: true` also matters here:
  // without it, this text query ambiguously matches both the dialog title
  // and its containing wrapper (which also holds the body copy), causing
  // a strict-mode violation.
  const confirmDialog = page.getByText('Confirm Leave Assignment', { exact: true });
  const dialogAppeared = await confirmDialog
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);

  if (dialogAppeared) {
    console.log('Insufficient-balance confirmation dialog shown as expected for a new employee with no leave balance; confirming with "Ok".');
    await page.getByRole('button', { name: 'Ok' }).click();
  } else {
    console.log('No insufficient-balance confirmation dialog appeared even though "Balance not sufficient" was shown before submitting; proceeding assuming the assignment went through directly.');
  }

  // ---- Step 3: Verify the leave request was recorded ----
  // Per app notes, the Leave List search can be unreliable in this
  // environment, so the "Successfully Saved" toast is the reliable signal
  // that the assignment was actually persisted.
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });
});
