import { test, expect } from '@playwright/test';

test.use({
  viewport: {
    height: 1200,
    width: 1900,
  },
});

function getFutureWeekdayDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  // Skip weekends - OrangeHRM rejects leave requests that only cover weekend days
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test('assign leave to a newly created employee', async ({ page }) => {
  const uniqueId = Date.now().toString(36);
  const firstName = `Jordan${uniqueId}`;
  const lastName = `Casey${uniqueId}`;
  const fullName = `${firstName} ${lastName}`;
  const leaveDate = getFutureWeekdayDate(10);

  await page.goto('http://localhost:8081/web/index.php/dashboard/index');

  // ---- 1. Create a new employee via PIM ----
  await page.getByRole('link', { name: 'PIM' }).click();
  await page.getByRole('heading', { name: 'Employee Information' }).waitFor();

  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);
  await page.getByRole('button', { name: 'Save' }).click();

  // Confirms the employee was created: URL moves to the personal details page
  // and the newly created employee's name is shown in the page header.
  await expect(page).toHaveURL(/viewPersonalDetails/, { timeout: 15000 });
  await expect(page.locator('.orangehrm-edit-employee-name')).toContainText(fullName, { timeout: 10000 });

  // ---- 2. Assign a leave request to that employee via Leave -> Assign Leave ----
  await page.getByRole('link', { name: 'Leave' }).click();
  await page.getByRole('link', { name: 'Assign Leave' }).click();
  await page.getByRole('heading', { name: 'Assign Leave' }).waitFor();

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(lastName);
  const suggestion = page.locator('.oxd-autocomplete-option', { hasText: fullName }).first();
  await suggestion.waitFor({ state: 'visible', timeout: 10000 });
  await suggestion.click();
  await expect(employeeInput).toHaveValue(new RegExp(`${firstName}\\s+${lastName}`), { timeout: 5000 });

  // Leave Type dropdown - pick the only available type, "Annual Leave"
  const leaveTypeSelect = page.locator('.oxd-select-text').first();
  await leaveTypeSelect.click();
  const annualLeaveOption = page.getByRole('option', { name: 'Annual Leave' });
  await annualLeaveOption.waitFor({ state: 'visible', timeout: 10000 });
  await annualLeaveOption.click();
  await expect(leaveTypeSelect).toHaveText('Annual Leave', { timeout: 5000 });

  const fromDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).first();
  await fromDateInput.click();
  await fromDateInput.pressSequentially(leaveDate, { delay: 30 });
  await page.getByRole('heading', { name: 'Assign Leave' }).click();
  await expect(fromDateInput).toHaveValue(leaveDate, { timeout: 5000 });

  // Setting "From Date" auto-fills "To Date" with the same value, so clear it first
  const toDateInput = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1);
  await toDateInput.click();
  await toDateInput.press('Control+A');
  await toDateInput.pressSequentially(leaveDate, { delay: 30 });
  await page.getByRole('heading', { name: 'Assign Leave' }).click();
  await expect(toDateInput).toHaveValue(leaveDate, { timeout: 5000 });

  await page.getByRole('button', { name: 'Assign' }).click();

  // New employees have no leave balance yet, so a confirmation dialog may appear -
  // wait briefly for it and dismiss it if it shows up.
  const okButton = page.getByRole('button', { name: 'Ok' });
  await okButton
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => okButton.click())
    .catch(() => {
      /* no confirmation dialog appeared - leave already had sufficient balance */
    });

  // ---- 3. Verify the leave request was recorded successfully ----
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 15000 });
});
