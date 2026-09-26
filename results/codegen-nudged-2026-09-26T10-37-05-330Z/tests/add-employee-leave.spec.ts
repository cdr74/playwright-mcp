import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Returns an ISO (yyyy-mm-dd) date string for a weekday at least
 * `minDaysAhead` days in the future. Weekends are skipped because the
 * Leave module rejects requests that only cover non-working days.
 */
function getFutureWeekdayDate(minDaysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + minDaysAhead);
  // 0 = Sunday, 6 = Saturday
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

/**
 * The OrangeHRM date inputs are fiddly: setting their value directly is
 * often ignored by the app's internal state. Selecting the existing text
 * and typing the replacement (rather than just filling it) reliably
 * registers the change, and Escape closes the popup calendar that opens
 * on focus so it doesn't obscure the next field.
 */
async function typeDate(page: Page, input: Locator, dateStr: string) {
  await input.click();
  await input.press('Control+A');
  await input.pressSequentially(dateStr);
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue(dateStr);
}

test('assign leave to a newly created employee', async ({ page }) => {
  const unique = Date.now().toString().slice(-6);
  const firstName = `Thomas${unique}`;
  const lastName = `Mueller${unique}`;
  const fullName = `${firstName} ${lastName}`;
  // The employee has no middle name, so OrangeHRM renders the full name
  // with a double space between first and last name in a few places
  // (autocomplete input value, suggestion text). Match flexibly for that.
  const fullNamePattern = new RegExp(`${firstName}\\s+${lastName}`);

  // --- Step 1: create the employee via PIM ---
  await page.goto('/web/index.php/pim/viewEmployeeList');
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Saving navigates to the employee's Personal Details page - confirm it
  // actually happened and shows the name we just created before moving on.
  await expect(page).toHaveURL(/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });
  await expect(page.getByText(fullNamePattern).first()).toBeVisible();

  // --- Step 2: assign leave to that employee via Leave -> Assign Leave ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  // The autocomplete only fires its lookup on real keystrokes (debounced
  // input listener) - a plain fill() sets the value without dispatching
  // the events it listens for, so type it out with a small delay instead.
  await employeeInput.pressSequentially(firstName, { delay: 100 });

  // Wait for the autocomplete suggestion matching our unique new employee
  // and select it (the name is unique, so exactly one match is expected).
  // The suggestion has no accessible role, so we fall back to the
  // widget's OrangeHRM-specific "option" class.
  const suggestion = page.locator('.oxd-autocomplete-option', { hasText: fullName });
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();
  await expect(employeeInput).toHaveValue(fullNamePattern);

  // Leave Type is a custom dropdown widget, not a native <select>, so it
  // has no accessible role/name to target directly - fall back to its
  // OrangeHRM-specific container class, scoped to the "Leave Type" field.
  const leaveTypeGroup = page.locator('.oxd-input-group', { hasText: 'Leave Type' });
  await leaveTypeGroup.locator('.oxd-select-text').click();
  const leaveTypeOption = page.getByRole('option', { name: 'Annual Leave' });
  await expect(leaveTypeOption).toBeVisible();
  await leaveTypeOption.click();
  await expect(leaveTypeGroup.locator('.oxd-select-text')).toHaveText('Annual Leave');

  const leaveDate = getFutureWeekdayDate(14);
  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  await typeDate(page, dateInputs.first(), leaveDate);
  await typeDate(page, dateInputs.nth(1), leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // --- Step 3: verify the leave request was recorded ---
  // New employees have no leave balance yet, so a confirmation dialog
  // about insufficient balance may appear and must be OK'd before the
  // "Successfully Saved" toast (the reliable success signal on this
  // build - the Leave List search itself is known to be flaky) shows up.
  // Both are checked together (rather than waiting out a fixed timeout
  // for the dialog first) since the toast can appear and auto-dismiss
  // within the time it'd take to conclude the dialog isn't coming.
  const successToast = page.getByText('Successfully Saved', { exact: false });
  const okButton = page.getByRole('button', { name: 'Ok' });
  await expect(okButton.or(successToast)).toBeVisible({ timeout: 15000 });

  if (await okButton.isVisible().catch(() => false)) {
    console.log('Insufficient-balance confirmation dialog appeared as expected for a new employee - confirming it.');
    await okButton.click();
    await expect(successToast).toBeVisible({ timeout: 15000 });
  } else {
    console.log('No insufficient-balance confirmation dialog appeared before the success toast - proceeding since the toast is what actually confirms success.');
  }
});
