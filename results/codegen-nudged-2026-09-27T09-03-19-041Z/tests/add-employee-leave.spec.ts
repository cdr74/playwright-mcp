import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Types a date into one of the leave-form date pickers.
 *
 * The OrangeHRM date inputs are fiddly: setting the value directly (fill())
 * is frequently not picked up by the underlying React state, so we clear
 * the field and type the date character-by-character instead, then close
 * the calendar popover with Escape. This is used for both the "From Date"
 * and "To Date" fields, so it's factored out rather than duplicated.
 */
async function typeDate(page: Page, dateInput: Locator, dateStr: string) {
  await dateInput.click();
  await dateInput.press('Control+A');
  await dateInput.press('Backspace');
  await dateInput.pressSequentially(dateStr);
  await page.keyboard.press('Escape');
  await expect(dateInput).toHaveValue(dateStr);
}

/** Returns the next weekday (Mon-Fri) strictly after today, as yyyy-mm-dd. */
function nextWeekday(): string {
  const d = new Date();
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().slice(0, 10);
}

test('assign leave to a newly created employee', async ({ page }) => {
  const unique = Date.now();
  const firstName = `Jordan${unique}`;
  const lastName = `Alvarez${unique}`;
  const fullName = `${firstName} ${lastName}`;
  const leaveDate = nextWeekday();

  // Start from the app's dashboard (already authenticated by run config).
  await page.goto('/web/index.php/dashboard/index');

  // --- Step 1: create a new employee via PIM ---
  await page.getByRole('link', { name: 'PIM' }).click();
  await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();

  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Saving navigates to the new employee's Personal Details page.
  await expect(page).toHaveURL(/viewPersonalDetails/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: fullName })).toBeVisible();

  // --- Step 2: assign leave to that employee via Leave > Assign Leave ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(firstName);

  // The autocomplete suggestion list is a custom widget without a
  // standard accessible role; match it by the visible suggestion text.
  const suggestion = page.locator('.oxd-autocomplete-option', { hasText: fullName }).first();
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();
  // The field's displayed value has no middle name, so OrangeHRM renders
  // it with a double space between first and last name - check for both
  // name parts rather than an exact string match.
  await expect(employeeInput).toHaveValue(new RegExp(`${firstName}\\s+${lastName}`));

  // Leave Type is a custom (non-native) dropdown widget. Only "Annual
  // Leave" is configured in this environment, so we open the dropdown
  // and pick that option explicitly by its visible text (its option list
  // items have no accessible role to key off of).
  const leaveTypeDropdown = page.getByText('-- Select --');
  await leaveTypeDropdown.click();
  const annualLeaveOption = page.locator('.oxd-select-option', { hasText: 'Annual Leave' });
  await expect(annualLeaveOption).toBeVisible({ timeout: 10000 });
  await annualLeaveOption.click();
  // Once selected, the placeholder text is replaced by the chosen value.
  await expect(leaveTypeDropdown).toHaveCount(0);

  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  await typeDate(page, dateInputs.first(), leaveDate);
  await typeDate(page, dateInputs.nth(1), leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance yet, so a confirmation dialog
  // about insufficient balance may appear and must be dismissed. It's
  // only shown sometimes (depends on the leave type's balance rules), so
  // we explicitly wait a bit for it and treat its absence as non-fatal,
  // logging why rather than silently ignoring it.
  const okButton = page.getByRole('button', { name: 'Ok' });
  const dialogAppeared = await okButton
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (dialogAppeared) {
    await okButton.click();
  } else {
    console.log(
      'No insufficient-balance confirmation dialog appeared within 8s of clicking Assign; ' +
        'this employee may already have had a leave balance, so proceeding to check ' +
        'for the success message directly.'
    );
  }

  // --- Step 3: verify the leave request was recorded ---
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });
});
