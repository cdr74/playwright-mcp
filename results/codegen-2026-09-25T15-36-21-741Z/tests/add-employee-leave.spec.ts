import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Returns a Date that is `daysAhead` days from now, nudged forward to the
 * next weekday if it lands on a Saturday/Sunday (leave requests covering
 * only non-working days are rejected server-side).
 */
function futureWeekday(daysAhead: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * The yyyy-mm-dd date inputs on the Assign Leave page have a date-picker
 * popup that gets out of sync with a plain `.fill()`. Click, clear via
 * keyboard, type the date character by character, then dismiss the popup.
 */
async function setDateField(page: Page, field: Locator, dateStr: string) {
  await field.click();
  await field.press('Control+A');
  await field.press('Backspace');
  await field.pressSequentially(dateStr, { delay: 30 });
  await page.keyboard.press('Escape');
}

test('add employee and assign them a leave request', async ({ page }) => {
  const unique = Date.now();
  const firstName = `Thomas${unique}`;
  const lastName = `Mueller${unique}`;

  // --- 1. Create employee via PIM ---
  await page.goto('/web/index.php/pim/addEmployee');

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Save redirects to the employee's personal details page.
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

  // --- 2. Assign leave to that employee ---
  await page.goto('/web/index.php/leave/assignLeave');

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(firstName);

  const fullName = `${firstName} ${lastName}`;
  await page.getByRole('option', { name: new RegExp(fullName) }).first().click();

  // Employee input renders as "First  Last" (two spaces) once selected.
  await expect(employeeInput).toHaveValue(`${firstName}  ${lastName}`);

  // Leave Type: custom dropdown. Opening it renders "-- Select --" itself
  // as the first option, so the first real leave type is at index 1.
  await page.getByText('-- Select --').click();
  const leaveTypeOptions = page.getByRole('listbox').getByRole('option');
  await expect(leaveTypeOptions.first()).toBeVisible();
  await leaveTypeOptions.nth(1).click();

  // Pick a single, future weekday date for both From and To.
  const leaveDate = formatDate(futureWeekday(14));
  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  await setDateField(page, dateInputs.nth(0), leaveDate);
  await setDateField(page, dateInputs.nth(1), leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // A brand-new employee has no leave balance yet, which raises a
  // confirmation dialog before the assignment actually saves.
  const confirmOk = page.getByRole('button', { name: 'Ok' });
  try {
    await confirmOk.waitFor({ state: 'visible', timeout: 3000 });
    await confirmOk.click();
  } catch {
    // No confirmation needed (employee already had sufficient balance).
  }

  // --- 3. Verify the leave request was recorded ---
  // The "Successfully Saved" toast is the primary, reliable success signal
  // (Leave List search is known to be flaky for freshly-assigned leave).
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 10000 });
});
