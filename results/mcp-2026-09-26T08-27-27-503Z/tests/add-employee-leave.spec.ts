import { test, expect } from '@playwright/test';

test('Add employee via PIM, assign leave, verify via API response', async ({ page }) => {
  test.setTimeout(90_000);

  const timestamp = Date.now();
  const firstName = `TestAuto${timestamp}`;
  const lastName = `QATest${timestamp}`;

  // Compute a future weekday date (roughly 2-3 weeks ahead, nudged to a weekday).
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 18);
  while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
    futureDate.setDate(futureDate.getDate() + 1);
  }
  const yyyy = futureDate.getFullYear();
  const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
  const dd = String(futureDate.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // --- Step 1-6: Create employee via PIM ---
  await page.goto('http://localhost:8081/web/index.php/pim/addEmployee');

  await page.getByRole('textbox', { name: 'First Name' }).fill(firstName);
  await page.getByRole('textbox', { name: 'Last Name' }).fill(lastName);

  await page.getByRole('button', { name: 'Save' }).click();

  await page.waitForURL(/\/pim\/viewPersonalDetails\/empNumber\/\d+/, { timeout: 30_000 });
  await expect(page.getByText('Personal Details').first()).toBeVisible();

  // --- Step 7-9: Navigate to Assign Leave and select employee ---
  await page.goto('http://localhost:8081/web/index.php/leave/assignLeave');

  const employeeInput = page.getByRole('textbox', { name: 'Type for hints...' });
  await employeeInput.click();
  await employeeInput.fill(firstName);

  const suggestion = page.getByRole('option', { name: `${firstName} ${lastName}` });
  await suggestion.waitFor({ state: 'visible', timeout: 15_000 });
  await suggestion.click();

  // --- Step 10-11: Select Leave Type ---
  await page.getByText('-- Select --').first().click();
  await page.getByRole('option', { name: 'Annual Leave' }).click();

  // --- Step 12: From Date ---
  const dateInputs = page.getByRole('textbox', { name: 'yyyy-mm-dd' });
  const fromDate = dateInputs.nth(0);
  await fromDate.click();
  await fromDate.press('Control+a');
  await fromDate.pressSequentially(dateStr, { delay: 50 });
  await page.keyboard.press('Escape');

  // --- Step 13: To Date ---
  const toDate = dateInputs.nth(1);
  await toDate.click();
  await toDate.press('Control+a');
  await toDate.pressSequentially(dateStr, { delay: 50 });
  await page.keyboard.press('Escape');

  // --- Step 14-15: Assign and confirm ---
  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/v2/leave/employees/leave-requests') &&
      resp.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Assign' }).click();

  const okButton = page.getByRole('button', { name: 'Ok' });
  await okButton.waitFor({ state: 'visible', timeout: 15_000 });
  await okButton.click();

  // --- Step 16: Verify via network response ---
  const response = await responsePromise;
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.data).toBeTruthy();
  expect(typeof body.data.id).toBe('number');
  expect(body.data.leaveType.name).toBe('Annual Leave');
  expect(body.data.dateApplied).toBe(dateStr);
});
