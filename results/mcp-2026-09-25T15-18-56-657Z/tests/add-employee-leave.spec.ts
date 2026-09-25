import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8081';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Find a future weekday (Mon-Fri) date, at least a few days ahead to avoid
// edge cases with "today" cutoffs.
function futureWeekday(daysAhead = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return toYMD(d);
}

test('add employee via PIM and assign leave via Leave module', async ({ page }) => {
  const suffix = Date.now().toString();
  const firstName = `TestQA${suffix}`;
  const lastName = `AutoGen${suffix}`;
  const leaveDate = futureWeekday();

  // Step 1: Create employee via PIM
  await page.goto(`${BASE_URL}/web/index.php/pim/addEmployee`);

  await page.locator('input[placeholder="First Name"]').fill(firstName);
  await page.locator('input[placeholder="Last Name"]').fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 15000 });

  // Step 2: Assign leave via Leave module admin flow
  await page.goto(`${BASE_URL}/web/index.php/leave/assignLeave`);

  const employeeInput = page.locator('input[placeholder="Type for hints..."]');
  await employeeInput.click();
  await employeeInput.fill(firstName);

  const employeeOption = page.getByRole('option', { name: `${firstName} ${lastName}` });
  await employeeOption.waitFor({ state: 'visible' });
  await employeeOption.click();

  // Sanity check the autocomplete rendered the selected value (two spaces
  // between first and last name, per known app behavior).
  await expect(employeeInput).toHaveValue(`${firstName}  ${lastName}`);

  // Leave Type custom dropdown
  await page.getByText('-- Select --').first().click();
  await page.getByRole('option', { name: 'Annual Leave' }).click();

  // From Date
  const fromDate = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).first();
  await fromDate.click();
  await fromDate.press('Control+A');
  await fromDate.pressSequentially(leaveDate, { delay: 50 });
  await page.keyboard.press('Escape');

  // To Date (same day, single-day leave request)
  const toDate = page.getByRole('textbox', { name: 'yyyy-mm-dd' }).nth(1);
  await toDate.click();
  await toDate.press('Control+A');
  await toDate.pressSequentially(leaveDate, { delay: 50 });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Assign' }).click();

  // Confirmation dialog for insufficient leave balance (expected for a
  // brand-new employee with no entitlement yet).
  const okButton = page.getByRole('button', { name: 'Ok' });
  await okButton.waitFor({ state: 'visible', timeout: 10000 });
  await okButton.click();

  // Primary success assertion: the "Successfully Saved" toast.
  await expect(page.getByText('Successfully Saved')).toBeVisible({ timeout: 10000 });
});
