import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Types a date into one of the Assign Leave date pickers.
 *
 * Per app notes, setting the value directly (e.g. via .fill() on some
 * builds) isn't reliably picked up by the underlying date-picker widget,
 * and clicking through the calendar UI is brittle across month boundaries.
 * Typing the yyyy-mm-dd string directly into the textbox and then closing
 * the popup with Escape is the approach that reliably works here.
 */
async function typeDate(field: Locator, isoDate: string) {
  await field.click();
  await field.fill(isoDate);
  await field.press('Escape');
}

/** Returns the next weekday (Mon-Fri) strictly after today, as yyyy-mm-dd. */
function nextWeekdayIso(daysAhead = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

test('add employee and assign them a leave request', async ({ page }) => {
  const uniqueSuffix = Date.now().toString().slice(-8);
  const firstName = `Thomas${uniqueSuffix}`;
  const lastName = `Mueller${uniqueSuffix}`;
  const fullName = `${firstName} ${lastName}`;
  const leaveDate = nextWeekdayIso();

  // --- Step 1: create a new employee via PIM ---
  await page.goto('/web/index.php/pim/addEmployee');
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  // Deliberately not enabling "Create Login Details" - not needed for
  // assigning leave, and skipping it keeps this test focused and less brittle.

  await page.getByRole('button', { name: 'Save' }).click();

  // A successful save redirects to the employee's Personal Details page.
  await expect(page).toHaveURL(/viewPersonalDetails/, { timeout: 15000 });
  // Accessible-name matching normalizes whitespace, so this tolerates the
  // extra space OrangeHRM renders between first/last name when there is no
  // middle name.
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();

  // --- Step 2: assign that employee a leave request via Leave > Assign Leave ---
  await page.goto('/web/index.php/leave/assignLeave');
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(firstName.slice(0, 8));

  // The autocomplete suggestion list has no accessible role/name exposed by
  // the app, so we fall back to matching the rendered option text.
  const suggestion = page.locator('.oxd-autocomplete-option', { hasText: fullName });
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();
  // OrangeHRM renders an extra space between first/last name when there is
  // no middle name, so allow for arbitrary whitespace here rather than an
  // exact string match.
  await expect(employeeInput).toHaveValue(new RegExp(`^${firstName}\\s+${lastName}$`));

  // Leave Type is the only real dropdown on this form (Leave Period is
  // auto-derived once dates are chosen), so there is exactly one
  // "-- Select --" control to open here.
  await page.getByText('-- Select --').click();
  await page.getByText('Annual Leave', { exact: true }).click();

  const dateFields = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  await typeDate(dateFields.nth(0), leaveDate);
  await typeDate(dateFields.nth(1), leaveDate);
  await expect(dateFields.nth(0)).toHaveValue(leaveDate);
  await expect(dateFields.nth(1)).toHaveValue(leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance, so a confirmation dialog about
  // insufficient balance is expected here - accept it. We still guard with
  // a try/waitFor rather than assuming it always appears, and log clearly
  // if it doesn't so a maintainer can tell what happened without rerunning.
  const okButton = page.getByRole('button', { name: 'Ok' });
  try {
    await okButton.waitFor({ state: 'visible', timeout: 5000 });
    await okButton.click();
  } catch {
    test.info().annotations.push({
      type: 'note',
      description:
        'Insufficient-balance confirmation dialog did not appear after clicking Assign; ' +
        'proceeding on the assumption the employee unexpectedly had a sufficient leave balance.',
    });
  }

  // --- Step 3: verify the leave request was recorded ---
  // Per app notes, the Leave List search is unreliable on this build, so the
  // "Successfully Saved" toast is the reliable signal that the assignment worked.
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 10000 });
});
