import { test, expect, type Page } from '@playwright/test';

/**
 * Fills one of the Assign Leave date fields ("From Date" / "To Date").
 * These are custom date-pickers where setting `.fill()` alone is often not
 * picked up by the app's internal state - typing the value and then
 * explicitly closing the picker popup (so it doesn't obscure whatever we
 * click next) is required, per app notes. Factored out because we need to
 * repeat this exact workaround for both date fields.
 */
async function setLeaveDate(page: Page, index: number, dateStr: string) {
  const dateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(index);
  await dateInput.click();
  await dateInput.fill(dateStr);
  await expect(dateInput).toHaveValue(dateStr);

  const closeControl = page.getByText('Close', { exact: true });
  if (await closeControl.isVisible().catch(() => false)) {
    await closeControl.click();
  }
}

/** Returns a future date (yyyy-mm-dd) that falls on a weekday, `daysAhead` or later. */
function futureWeekdayDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  // Nudge forward past any weekend so the leave request isn't rejected
  // with "No Working Days Selected".
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

test('add employee and assign them a leave request', async ({ page }) => {
  const uniqueId = Date.now().toString();
  const firstName = 'TestQA';
  const lastName = `Auto${uniqueId}`;
  // OrangeHRM renders employee display names as "First Middle Last"; with no
  // middle name entered, that can leave extra whitespace between the parts.
  const fullNamePattern = new RegExp(`^${firstName}\\s+${lastName}$`);
  const leaveDate = futureWeekdayDate(14);

  // --- Step 1: Create the employee via PIM ---
  await page.goto('/web/index.php/pim/addEmployee');
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Confirms the employee was created and we landed on their profile page.
  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible();

  // --- Step 2: Assign leave to the new employee via Leave -> Assign Leave ---
  await page.goto('/web/index.php/leave/assignLeave');
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(`${firstName} ${lastName}`);

  const employeeOption = page.getByRole('option', { name: fullNamePattern });
  await expect(employeeOption).toBeVisible({ timeout: 10000 });
  const selectedName = (await employeeOption.textContent())?.trim() ?? `${firstName} ${lastName}`;
  await employeeOption.click();

  // Confirm the autocomplete actually took the selection (input reflects chosen name).
  await expect(employeeInput).toHaveValue(fullNamePattern);

  // Leave Type is a custom dropdown widget, not a native <select>.
  await page.getByText('-- Select --').first().click();
  const annualLeaveOption = page.getByRole('option', { name: 'Annual Leave' });
  await expect(annualLeaveOption).toBeVisible();
  await annualLeaveOption.click();
  await expect(page.getByText('Annual Leave', { exact: true })).toBeVisible();

  // Single-day request: From Date and To Date are the same future weekday.
  await setLeaveDate(page, 0, leaveDate);
  await setLeaveDate(page, 1, leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance yet, so a confirmation dialog is
  // expected here - it's not a failure, just OK it to proceed. Note: the
  // dialog's title renders as a plain paragraph in the DOM, not a heading,
  // so we match on its exact text rather than an ARIA role. We explicitly
  // `waitFor` (rather than `isVisible`, which does not wait) since the
  // dialog takes a moment to animate in after the click.
  const confirmDialogText = page.getByText('Confirm Leave Assignment', { exact: true });
  const dialogAppeared = await confirmDialogText
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (dialogAppeared) {
    await page.getByRole('button', { name: 'Ok' }).click();
  } else {
    console.log(
      'No "Confirm Leave Assignment" dialog appeared - proceeding without confirming; ' +
      'this can happen if the environment already granted the employee a leave balance.'
    );
  }

  // --- Step 3: Verify the leave request was recorded ---
  // Per app notes, the Leave List search is unreliable in this build, so the
  // "Successfully Saved" toast is the reliable success signal to check.
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });

  // Sanity check the option we selected really was for our generated employee.
  expect(selectedName).toMatch(fullNamePattern);
});
