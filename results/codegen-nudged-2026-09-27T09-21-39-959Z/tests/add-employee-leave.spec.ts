import { test, expect } from '@playwright/test';

// OrangeHRM rejects leave requests that only cover a weekend day
// ("No Working Days Selected"), so we need a date that's both in the
// future and falls on a weekday.
function getFutureWeekdayDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Typing directly into these fiddly date inputs is the only reliable way to
// set them on this build. Selecting the From Date auto-populates the To Date
// with the same value, so a plain `.fill()` on To Date (which selects the
// existing text first) can end up appending rather than replacing - we
// select-all explicitly via keyboard to guard against that.
async function setDateField(page: import('@playwright/test').Page, input: import('@playwright/test').Locator, value: string) {
  await input.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value);
  await page.keyboard.press('Escape');
}

test('admin can create an employee and assign them a leave request', async ({ page }) => {
  const uniqueSuffix = Date.now();
  const firstName = `Test${uniqueSuffix}`;
  const lastName = `Employee${uniqueSuffix}`;
  // The autocomplete's selected value includes the (empty) middle name slot,
  // which OrangeHRM renders as a double space between first and last name.
  const nameParts = new RegExp(`^${firstName}\\s+${lastName}`);

  // Land on the authenticated dashboard first; the session is already logged in.
  await page.goto('/web/index.php/dashboard/index');
  await expect(page.getByRole('link', { name: 'PIM' })).toBeVisible({ timeout: 15000 });

  // --- Step 1: Create a new employee via PIM ---
  await page.getByRole('link', { name: 'PIM' }).click();
  await expect(page.getByRole('heading', { name: 'Employee Information' })).toBeVisible();

  await page.getByRole('button', { name: ' Add' }).click();
  await expect(page.getByRole('heading', { name: 'Add Employee' })).toBeVisible();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  await page.getByRole('button', { name: 'Save' }).click();

  // A successful save navigates to the new employee's Personal Details page.
  await expect(page.getByRole('heading', { name: 'Personal Details' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(nameParts)).toBeVisible();

  // --- Step 2: Assign that employee a leave request via Leave -> Assign Leave ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await expect(page.getByRole('heading', { name: 'Assign Leave' })).toBeVisible();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.fill(firstName);
  const suggestion = page.getByRole('option', { name: nameParts });
  await expect(suggestion).toBeVisible({ timeout: 10000 });
  await suggestion.click();
  await expect(employeeInput).toHaveValue(nameParts);

  // Leave Type is a custom dropdown widget, not a native <select>.
  await page.getByText('-- Select --').first().click();
  await page.getByRole('option', { name: 'Annual Leave' }).click();

  const leaveDate = getFutureWeekdayDate(7); // a week out: comfortably in the future
  const fromDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).first();
  const toDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1);

  await setDateField(page, fromDateInput, leaveDate);
  await expect(fromDateInput).toHaveValue(leaveDate);

  // Setting From Date auto-fills To Date with the same value for a
  // single-day request; only overwrite it if that didn't happen.
  const toDateValue = await toDateInput.inputValue();
  if (toDateValue !== leaveDate) {
    await setDateField(page, toDateInput, leaveDate);
  }
  await expect(toDateInput).toHaveValue(leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance, so a confirmation dialog about
  // insufficient balance appears before the assignment is committed - it
  // has to be dismissed with "Ok" for the request to actually go through.
  const okButton = page.getByRole('button', { name: 'Ok' });
  await expect(okButton).toBeVisible({ timeout: 10000 });
  console.log(
    'Insufficient balance confirmation dialog appeared (expected for a new employee with no leave balance); clicking Ok to proceed.'
  );
  await okButton.click();

  // --- Step 3: Verify the leave request was recorded ---
  // The Leave List search is known to be unreliable on this build, so the
  // "Successfully Saved" toast is the reliable signal that the assignment worked.
  // The toast is short-lived, so we assert with polling (expect(...).toBeVisible)
  // rather than a one-shot isVisible() check, which doesn't wait at all.
  const successToast = page.getByText('Successfully Saved');
  try {
    await expect(successToast).toBeVisible({ timeout: 15000 });
  } catch (err) {
    const bodyText = await page.locator('body').innerText();
    console.log('Success toast did not appear. Page body text:', bodyText.slice(0, 1500));
    throw err;
  }
});
