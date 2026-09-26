import { test, expect } from '@playwright/test';

test.use({
  viewport: {
    height: 1200,
    width: 1900,
  },
});

/**
 * Returns the next weekday (Mon-Fri) strictly after the given date,
 * formatted as yyyy-mm-dd. Used to pick a valid, future, single-day
 * leave date (weekends are rejected by the app as "No Working Days
 * Selected").
 */
function nextWeekdayAfter(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test('create employee and assign leave', async ({ page }) => {
  const uniqueSuffix = Date.now().toString();
  const firstName = `Cera${uniqueSuffix}`;
  const lastName = `Test${uniqueSuffix}`;
  const fullName = `${firstName} ${lastName}`;
  const leaveDate = nextWeekdayAfter(new Date());

  await page.goto('http://localhost:8081/web/index.php/dashboard/index');
  await page.waitForLoadState('networkidle');

  // --- Step 1: Create a new employee via PIM ---
  await page.getByRole('link', { name: 'PIM' }).click();
  await page.getByRole('button', { name: ' Add' }).click();

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  // Confirm the employee was created: the app navigates to the Personal
  // Details page and shows a success toast.
  await expect(page.getByText('Successfully Saved')).toBeVisible();
  await expect(page).toHaveURL(/viewPersonalDetails/);

  // --- Step 2: Assign the employee a leave request via Leave -> Assign Leave ---
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(firstName);

  // Wait for and select the matching autocomplete suggestion.
  const suggestion = page.getByText(fullName, { exact: false }).first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();

  // Leave Type dropdown - the environment has exactly one leave type,
  // "Annual Leave", so select it explicitly by its visible text.
  await page.getByText('-- Select --', { exact: true }).first().click();
  await page.getByText('Annual Leave', { exact: true }).click();

  // Fill From Date and To Date with the same future weekday (single-day leave).
  // Typing the date directly is required (setting the value via fill()
  // alone is not always picked up). The To Date field auto-populates once
  // From Date is set, so it must be cleared before typing to avoid the new
  // value being appended to the existing one.
  const fromDateInput = page.getByPlaceholder('yyyy-mm-dd').first();
  await fromDateInput.click();
  await fromDateInput.press('Control+A');
  await fromDateInput.press('Delete');
  await fromDateInput.pressSequentially(leaveDate, { delay: 30 });

  const toDateInput = page.getByPlaceholder('yyyy-mm-dd').nth(1);
  await toDateInput.click();
  await toDateInput.press('Control+A');
  await toDateInput.press('Delete');
  await toDateInput.pressSequentially(leaveDate, { delay: 30 });

  // Sanity check the fields hold the expected values before submitting.
  await expect(fromDateInput).toHaveValue(leaveDate);
  await expect(toDateInput).toHaveValue(leaveDate);

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance, so a confirmation dialog about
  // insufficient balance is expected - accept it.
  const okButton = page.getByRole('button', { name: 'Ok' });
  await expect(okButton).toBeVisible();
  await okButton.click();

  // --- Step 3: Verify the leave request was recorded successfully ---
  await expect(page.getByText('Successfully Saved')).toBeVisible();
});
